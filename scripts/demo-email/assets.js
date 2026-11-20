'use strict';

// Generates the demo email's binary assets (PNG images, a PDF invoice, an
// iCalendar event and a CSV) at runtime with no dependencies, so no binary
// files need to be committed.

const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Minimal PNG encoder + signed-distance-field rasteriser (anti-aliased shapes)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = buffer => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
};

const hex = value => {
  const n = parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp01 = v => Math.max(0, Math.min(1, v));

// Signed distance functions (negative inside the shape).
const sdf = {
  circle: (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r,
  ring: (cx, cy, r, width) => (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) - width / 2,
  roundRect: (x0, y0, w, h, r) => (x, y) => {
    const qx = Math.abs(x - (x0 + w / 2)) - (w / 2 - r);
    const qy = Math.abs(y - (y0 + h / 2)) - (h / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  },
  segment: (ax, ay, bx, by, width) => (x, y) => {
    const pax = x - ax;
    const pay = y - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
    return Math.hypot(pax - bax * h, pay - bay * h) - width / 2;
  },
  intersect: (a, b) => (x, y) => Math.max(a(x, y), b(x, y)),
  subtract: (a, b) => (x, y) => Math.max(a(x, y), -b(x, y)),
};

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
  }

  blend(x, y, rgb, alpha) {
    if (alpha <= 0) return;
    const i = (y * this.width + x) * 4;
    const p = this.pixels;
    const dstA = p[i + 3] / 255;
    const outA = alpha + dstA * (1 - alpha);
    for (let c = 0; c < 3; c++) {
      p[i + c] = Math.round((rgb[c] * alpha + p[i + c] * dstA * (1 - alpha)) / (outA || 1));
    }
    p[i + 3] = Math.round(outA * 255);
  }

  // Fills every pixel with colorFn(x, y) -> [r, g, b].
  paint(colorFn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.blend(x, y, colorFn(x, y), 1);
    }
    return this;
  }

  // Draws a shape given by a distance function, anti-aliased over one pixel.
  shape(distanceFn, color, opacity = 1) {
    const rgb = typeof color === 'string' ? hex(color) : color;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const coverage = clamp01(0.5 - distanceFn(x + 0.5, y + 0.5));
        if (coverage > 0) this.blend(x, y, rgb, coverage * opacity);
      }
    }
    return this;
  }

  toPng() {
    const rowLength = this.width * 4 + 1;
    const raw = Buffer.alloc(rowLength * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * rowLength] = 0; // filter: none
      this.pixels.copy(raw, y * rowLength + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // colour type: RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', header),
      pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const BRAND = '#0f766e';
const BRAND_DARK = '#134e4a';

const logo = () => {
  const c = new Canvas(120, 120);
  c.shape(sdf.roundRect(0, 0, 120, 120, 26), BRAND);
  // Stylised pine tree: three stacked triangles approximated by thick segments.
  [[34, 30], [46, 24], [58, 18]].forEach(([y, half]) => {
    c.shape(sdf.segment(60 - half, y + 20, 60, y, 7), '#ffffff');
    c.shape(sdf.segment(60, y, 60 + half, y + 20, 7), '#ffffff');
  });
  c.shape(sdf.roundRect(56, 78, 8, 22, 3), '#ffffff');
  return c.toPng();
};

const hero = () => {
  const width = 1200;
  const height = 440;
  const from = hex(BRAND);
  const to = hex(BRAND_DARK);
  const c = new Canvas(width, height).paint((x, y) => mix(from, to, clamp01((x / width) * 0.6 + (y / height) * 0.4)));
  // Soft decorative circles.
  c.shape(sdf.circle(1040, 80, 220), '#ffffff', 0.06);
  c.shape(sdf.circle(160, 470, 260), '#ffffff', 0.05);
  c.shape(sdf.circle(980, 420, 120), '#99f6e4', 0.12);
  // Parcel illustration on the right.
  c.shape(sdf.roundRect(830, 170, 220, 170, 14), '#f5d0a9');
  c.shape(sdf.roundRect(830, 170, 220, 36, 10), '#e7b98a');
  c.shape(sdf.roundRect(925, 170, 30, 170, 2), '#c98d5a', 0.85);
  c.shape(sdf.roundRect(855, 280, 70, 40, 4), '#ffffff', 0.9);
  // Motion lines.
  [[700, 220, 790], [670, 260, 790], [720, 300, 790]].forEach(([x0, y, x1]) =>
    c.shape(sdf.segment(x0, y, x1, y, 8), '#ffffff', 0.35));
  return c.toPng();
};

const productShoe = () => {
  const c = new Canvas(360, 360).paint(() => hex('#e0f2fe'));
  c.shape(sdf.roundRect(60, 200, 250, 60, 30), '#0369a1');
  c.shape(sdf.roundRect(70, 120, 150, 120, 50), '#0ea5e9');
  c.shape(sdf.roundRect(180, 170, 120, 70, 35), '#0ea5e9');
  c.shape(sdf.roundRect(50, 252, 270, 20, 10), '#f8fafc');
  [130, 155, 180].forEach(x => c.shape(sdf.segment(x, 140, x + 20, 160, 6), '#f8fafc'));
  return c.toPng();
};

const productTote = () => {
  const c = new Canvas(360, 360).paint(() => hex('#fef3c7'));
  c.shape(sdf.intersect(sdf.ring(180, 140, 55, 14), (x, y) => y - 140), '#92400e');
  c.shape(sdf.roundRect(90, 130, 180, 170, 18), '#d97706');
  c.shape(sdf.roundRect(130, 190, 100, 60, 8), '#fde68a');
  return c.toPng();
};

const productMug = () => {
  const c = new Canvas(360, 360).paint(() => hex('#ede9fe'));
  c.shape(sdf.ring(250, 190, 40, 18), '#6d28d9');
  c.shape(sdf.roundRect(100, 110, 150, 170, 22), '#7c3aed');
  c.shape(sdf.roundRect(100, 110, 150, 22, 10), '#a78bfa');
  [[150, 70, 155, 95], [180, 60, 185, 95], [210, 70, 205, 95]].forEach(([x0, y0, x1, y1]) =>
    c.shape(sdf.segment(x0, y0, x1, y1, 6), '#a78bfa', 0.8));
  return c.toPng();
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

// Builds a single-page PDF with Helvetica text lines. ASCII only, so byte
// offsets equal string lengths.
const invoicePdf = order => {
  const escapePdf = text => text.replace(/[\\()]/g, m => '\\' + m);
  const lines = [
    [24, 'Fjord & Pine Outfitters'],
    [12, 'Invoice ' + order.invoiceNumber + '   |   Order ' + order.id + '   |   ' + order.date],
    [12, ''],
    [12, 'Bill to: ' + order.customer.name + ', ' + order.address.join(', ')],
    [12, ''],
    ...order.items.map(item => [11, item.qty + ' x ' + item.name + ' (' + item.variant + ')  ....  EUR ' + item.total]),
    [11, ''],
    [11, 'Subtotal  EUR ' + order.subtotal],
    [11, 'Shipping  EUR ' + order.shipping],
    [11, 'Discount (WELCOME10)  EUR -' + order.discount],
    [11, 'VAT 21% (included)  EUR ' + order.vat],
    [14, 'Total  EUR ' + order.total],
    [9, ''],
    [9, 'This is a generated demo document for sendgrid-mock. It is not a real invoice.'],
  ];

  let y = 780;
  const textOps = lines.map(([size, text]) => {
    const op = 'BT /F1 ' + size + ' Tf 56 ' + y + ' Td (' + escapePdf(text) + ') Tj ET';
    y -= size + 10;
    return op;
  }).join('\n');
  const stream = '0.06 0.46 0.43 rg 0 812 595 30 re f\n0 0 0 rg\n' + textOps;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    return offset;
  });
  const xrefOffset = pdf.length;
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  pdf += offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
};

const icsDate = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const deliveryIcs = order => Buffer.from([
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Fjord & Pine//sendgrid-mock demo//EN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  'UID:' + order.id + '@fjordandpine.example',
  'DTSTAMP:' + icsDate(new Date()),
  'DTSTART:' + icsDate(order.deliveryStart),
  'DTEND:' + icsDate(order.deliveryEnd),
  'SUMMARY:Delivery window for order ' + order.id,
  'LOCATION:' + order.address.join(', ').replace(/[,;]/g, m => '\\' + m),
  'DESCRIPTION:Tracking number ' + order.tracking + ' (NordPost)',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n'), 'utf8');

const orderCsv = order => Buffer.from([
  'sku,name,variant,quantity,unit_price_eur,total_eur',
  ...order.items.map(i => [i.sku, '"' + i.name + '"', '"' + i.variant + '"', i.qty, i.price, i.total].join(',')),
  '',
].join('\n'), 'utf8');

module.exports = {
  logo,
  hero,
  productShoe,
  productTote,
  productMug,
  invoicePdf,
  deliveryIcs,
  orderCsv,
};
