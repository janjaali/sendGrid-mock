// Pure helpers for reading SendGrid v3 mail payloads as stored by the mock.

const asArray = value => (Array.isArray(value) ? value : []);

export const getSubject = mail =>
  mail.subject || asArray(mail.personalizations).map(p => p.subject).find(Boolean) || '';

const formatAddress = address => {
  if (!address) return '';
  return address.name ? `${address.name} <${address.email}>` : address.email;
};

export const getFrom = mail => formatAddress(mail.from);

// Flattens to/cc/bcc across all personalizations: [{ kind, email, name }].
export const getRecipients = mail =>
  asArray(mail.personalizations).flatMap(p =>
    ['to', 'cc', 'bcc'].flatMap(kind =>
      asArray(p[kind]).map(address => ({ kind, email: address.email, name: address.name }))
    )
  );

export const getRecipientsByKind = (mail, kind) =>
  getRecipients(mail).filter(r => r.kind === kind).map(formatAddress);

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const formatDateTime = isoString => {
  const date = new Date(isoString);
  return isNaN(date) ? String(isoString || '') : dateTimeFormat.format(date);
};

export const getContent = (mail, type) =>
  asArray(mail.content).find(c => c.type === type)?.value;

export const hasTemplateData = mail =>
  asArray(mail.personalizations).some(p => p.dynamic_template_data);

// The tabs the viewer should offer for a mail, in display order.
export const getAvailableViews = mail => {
  const views = [];
  if (getContent(mail, 'text/html') !== undefined) views.push({ id: 'html', label: 'HTML' });
  if (getContent(mail, 'text/plain') !== undefined) views.push({ id: 'plain', label: 'Plain text' });
  if (mail.template_id || hasTemplateData(mail)) views.push({ id: 'template', label: 'Template data' });
  views.push({ id: 'raw', label: 'Raw JSON' });
  return views;
};

// Replaces cid: references with data URIs so inline images render in the preview.
export const inlineCidAttachments = (html, attachments) =>
  asArray(attachments)
    .filter(a => a.disposition === 'inline' && a.content_id)
    .reduce(
      (content, a) => content.split(`cid:${a.content_id}`).join(`data:${a.type};base64,${a.content}`),
      html
    );

// Decoded size of a base64 payload, without decoding it.
export const base64Size = base64 => {
  if (!base64) return 0;
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
};

export const formatBytes = bytes => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ---- Date filter helpers ---------------------------------------------------
// <input type="datetime-local"> works with local "YYYY-MM-DDTHH:mm" strings,
// while the API and shareable URLs use ISO-8601 strings.

const pad = n => String(n).padStart(2, '0');

export const isoToLocalInput = iso => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const localInputToIso = local => {
  if (!local) return '';
  const date = new Date(local);
  return isNaN(date) ? '' : date.toISOString();
};

// Text filters do a "contains" match unless the user already used the API's
// %...% syntax themselves.
export const toContainsPattern = value => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('%') && trimmed.endsWith('%') ? trimmed : `%${trimmed}%`;
};
