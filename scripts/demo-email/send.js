#!/usr/bin/env node
'use strict';

// Sends a complex, realistic HTML email to a running sendgrid-mock instance.
//
//   node scripts/demo-email/send.js [options]
//
// Run with --help for the options.

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const assets = require('./assets');

const HELP = `Send a complex demo HTML email to sendgrid-mock.

Usage: node scripts/demo-email/send.js [options]

Options:
  --url <url>        Mock base URL       (default: $SENDGRID_MOCK_URL or http://localhost:3000)
  --api-key <key>    API key             (default: $API_KEY or sendgrid-api-key)
  --to <email>       Recipient address   (default: ingrid.solberg@example.com)
  --count <n>        Send n copies       (default: 1)
  --dry-run          Don't send; print a payload summary instead
  --out <file>       Also write the JSON payload to <file>
  -h, --help         Show this help
`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = argv => {
  const options = {
    url: process.env.SENDGRID_MOCK_URL || 'http://localhost:3000',
    apiKey: process.env.API_KEY || 'sendgrid-api-key',
    to: 'ingrid.solberg@example.com',
    count: 1,
    dryRun: false,
    out: null,
  };
  const takeValue = (i, flag) => {
    if (i + 1 >= argv.length) throw new Error(`Missing value for ${flag}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
    case '--url': options.url = takeValue(i, arg); i++; break;
    case '--api-key': options.apiKey = takeValue(i, arg); i++; break;
    case '--to': options.to = takeValue(i, arg); i++; break;
    case '--count': options.count = parseInt(takeValue(i, arg), 10); i++; break;
    case '--out': options.out = takeValue(i, arg); i++; break;
    case '--dry-run': options.dryRun = true; break;
    case '-h': case '--help': options.help = true; break;
    default: throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be a positive integer');
  return options;
};

// ---------------------------------------------------------------------------
// Order data (kept in sync with the static content of email.html/email.txt)
// ---------------------------------------------------------------------------

const atLocalTime = (date, hours) => {
  const d = new Date(date);
  d.setHours(hours, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const fmt = (date, options) => new Intl.DateTimeFormat('en-GB', options).format(date);

const buildOrder = to => {
  const now = new Date();
  const deliveryDate = addDays(now, 2);
  const deliveryStart = atLocalTime(deliveryDate, 10);
  const deliveryEnd = atLocalTime(deliveryDate, 14);
  const id = 'FP-' + String(20000 + crypto.randomInt(80000));

  return {
    id,
    invoiceNumber: 'INV-' + now.getFullYear() + '-' + id.slice(3),
    tracking: 'NP' + crypto.randomBytes(5).toString('hex').toUpperCase() + 'NO',
    date: fmt(now, { day: '2-digit', month: 'short', year: 'numeric' }),
    customer: { id: 'cus_' + crypto.randomBytes(6).toString('hex'), name: 'Ingrid Solberg', firstName: 'Ingrid', email: to },
    address: ['Strandgaten 18, 3. etg', '5013 Bergen', 'Norway'],
    deliveryStart,
    deliveryEnd,
    orderedOn: fmt(addDays(now, -2), { day: 'numeric', month: 'short' }),
    packedOn: fmt(addDays(now, -1), { day: 'numeric', month: 'short' }),
    deliveryDay: fmt(deliveryDate, { weekday: 'long', day: 'numeric', month: 'long' }),
    deliveryDayShort: fmt(deliveryDate, { weekday: 'short', day: 'numeric', month: 'short' }),
    deliveryWindow: '10:00–14:00',
    couponExpiry: fmt(addDays(now, 30), { day: 'numeric', month: 'long', year: 'numeric' }),
    items: [
      { sku: 'TRS-GLB-43', name: 'Trail Runner Sneakers', variant: 'Glacier blue, EU 43', qty: 1, price: '129.00', total: '129.00' },
      { sku: 'WCT-AMB-18', name: 'Waxed Canvas Tote', variant: 'Amber, 18 L', qty: 1, price: '79.00', total: '79.00' },
      { sku: 'SWM-VIO-350', name: 'Stoneware Mug', variant: 'Violet glaze, 350 ml', qty: 2, price: '18.50', total: '37.00' },
    ],
    subtotal: '245.00',
    shipping: '4.95',
    discount: '24.50',
    vat: '39.13',
    total: '225.45',
  };
};

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const render = (template, values, escape) => template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
  if (!(key in values)) throw new Error(`Template placeholder {{${key}}} has no value`);
  return escape ? escapeHtml(values[key]) : String(values[key]);
});

const attachment = (filename, type, buffer, disposition = 'attachment', contentId) => ({
  content: buffer.toString('base64'),
  filename,
  type,
  disposition,
  ...(contentId ? { content_id: contentId } : {}),
});

const buildPayload = order => {
  const values = {
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    tracking: order.tracking,
    firstName: order.customer.firstName,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerId: order.customer.id,
    orderedOn: order.orderedOn,
    packedOn: order.packedOn,
    deliveryDay: order.deliveryDay,
    deliveryDayShort: order.deliveryDayShort,
    deliveryWindow: order.deliveryWindow,
    couponExpiry: order.couponExpiry,
  };
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

  return {
    personalizations: [{
      to: [{ email: order.customer.email, name: order.customer.name }],
      cc: [{ email: 'erik.solberg@example.com', name: 'Erik Solberg' }],
      bcc: [{ email: 'orders-archive@fjordandpine.example' }],
      custom_args: { order_id: order.id, customer_id: order.customer.id },
    }],
    from: { email: 'orders@fjordandpine.example', name: 'Fjord & Pine' },
    reply_to: { email: 'help@fjordandpine.example', name: 'Fjord & Pine Support' },
    subject: `📦 Your order ${order.id} is on its way`,
    content: [
      // SendGrid requires text/plain before text/html.
      { type: 'text/plain', value: render(read('email.txt'), values, false) },
      { type: 'text/html', value: render(read('email.html'), values, true) },
    ],
    attachments: [
      attachment('logo.png', 'image/png', assets.logo(), 'inline', 'logo'),
      attachment('hero.png', 'image/png', assets.hero(), 'inline', 'hero'),
      attachment('trail-runner.png', 'image/png', assets.productShoe(), 'inline', 'product-shoe'),
      attachment('canvas-tote.png', 'image/png', assets.productTote(), 'inline', 'product-tote'),
      attachment('stoneware-mug.png', 'image/png', assets.productMug(), 'inline', 'product-mug'),
      attachment(`${order.invoiceNumber}.pdf`, 'application/pdf', assets.invoicePdf(order)),
      attachment('delivery-window.ics', 'text/calendar', assets.deliveryIcs(order)),
      attachment(`order-${order.id}.csv`, 'text/csv', assets.orderCsv(order)),
    ],
    categories: ['transactional', 'order-shipped'],
    custom_args: { campaign: 'shipping-update', template_version: '2026-11' },
    headers: {
      'X-Entity-Ref-ID': crypto.randomUUID(),
      'List-Unsubscribe': `<https://fjordandpine.example/unsubscribe?u=${order.customer.id}>, <mailto:unsubscribe@fjordandpine.example>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tracking_settings: {
      click_tracking: { enable: true, enable_text: false },
      open_tracking: { enable: true },
    },
  };
};

// ---------------------------------------------------------------------------
// HTTP (works on Node 16+, no fetch needed)
// ---------------------------------------------------------------------------

const post = (url, apiKey, body) => new Promise((resolve, reject) => {
  const target = new URL('/v3/mail/send', url);
  const client = target.protocol === 'https:' ? https : http;
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  const request = client.request(target, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  }, response => {
    let text = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: text }));
  });
  request.on('error', reject);
  request.end(data);
});

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;

const summarize = payload => {
  const json = JSON.stringify(payload);
  console.log(`Subject:     ${payload.subject}`);
  console.log(`To/Cc/Bcc:   ${payload.personalizations[0].to[0].email} / ${payload.personalizations[0].cc[0].email} / ${payload.personalizations[0].bcc[0].email}`);
  console.log(`HTML body:   ${kb(Buffer.byteLength(payload.content[1].value))}, plain text: ${kb(Buffer.byteLength(payload.content[0].value))}`);
  payload.attachments.forEach(a => {
    const size = Buffer.from(a.content, 'base64').length;
    console.log(`Attachment:  ${a.filename.padEnd(24)} ${a.type.padEnd(16)} ${kb(size).padStart(9)}  ${a.disposition}${a.content_id ? ` (cid:${a.content_id})` : ''}`);
  });
  console.log(`Payload:     ${kb(Buffer.byteLength(json))} (mock limit: 5 MB)`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(HELP); return; }

  for (let n = 1; n <= options.count; n++) {
    const order = buildOrder(options.to);
    const payload = buildPayload(order);

    if (n === 1) summarize(payload);
    if (options.out && n === 1) {
      fs.writeFileSync(options.out, JSON.stringify(payload, null, 2));
      console.log(`Wrote payload to ${options.out}`);
    }
    if (options.dryRun) continue;

    const response = await post(options.url, options.apiKey, payload);
    if (response.status !== 202) {
      throw new Error(`Mock responded ${response.status}: ${response.body || '(empty body)'}`);
    }
    console.log(`Sent ${n}/${options.count}: order ${order.id}, X-Message-ID ${response.headers['x-message-id']}`);
  }

  if (!options.dryRun) console.log(`\nOpen the UI at ${new URL('/', options.url).href}`);
};

main().catch(error => {
  // Node 18+ wraps connection failures in an AggregateError with an empty message.
  const code = error.code || (error.errors && error.errors[0] && error.errors[0].code);
  const message = error.message || code || String(error);
  const hint = code === 'ECONNREFUSED'
    ? ' (is sendgrid-mock running? Use --url to point at it)'
    : '';
  console.error(`Error: ${message}${hint}`);
  process.exit(1);
});
