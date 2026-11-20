import React, { useEffect, useRef, useState } from 'react';

import {
  base64Size,
  formatBytes,
  formatDateTime,
  getAvailableViews,
  getContent,
  getFrom,
  getRecipientsByKind,
  getSubject,
  inlineCidAttachments,
} from './mailUtils';

// Email HTML is untrusted: render it in a sandboxed iframe (no scripts, no
// same-origin access) so it can neither run code nor restyle the app.
// Links open in a new tab.
const withBaseTarget = html => {
  const base = '<base target="_blank">';
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, match => match + base)
    : base + html;
};

const HtmlPreview = ({ mail }) => {
  const html = withBaseTarget(
    inlineCidAttachments(getContent(mail, 'text/html') || '', mail.attachments)
  );
  return (
    <iframe
      className="html-frame"
      title="HTML preview of the mail"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={html}
    />
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (copied === null) return undefined;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    if (!navigator.clipboard) { setCopied(false); return; }
    navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false));
  };

  return (
    <>
      <span role="status" className="feedback">
        {copied === true && 'Copied'}
        {copied === false && 'Copy failed'}
      </span>
      <button type="button" className="btn btn-sm" onClick={copy}>Copy</button>
    </>
  );
};

const CodeBlock = ({ text, label }) => (
  <>
    <div className="tab-panel-toolbar"><CopyButton text={text} /></div>
    <pre className="code-block" tabIndex={0} aria-label={label}><code>{text}</code></pre>
  </>
);

const TemplateData = ({ mail }) => (
  (mail.personalizations || []).map((p, index) => (
    <section key={index}>
      {mail.personalizations.length > 1 && (
        <h3 className="section-title">
          Personalization {index + 1}: {(p.to || []).map(t => t.email).join(', ')}
        </h3>
      )}
      <CodeBlock
        label={'Template data for personalization ' + (index + 1)}
        text={JSON.stringify(p.dynamic_template_data || {}, null, 2)}
      />
    </section>
  ))
);

// Attachment payloads can be large; summarise them in the raw view.
const rawJson = mail => JSON.stringify({
  ...mail,
  attachments: mail.attachments?.map(a => ({
    ...a,
    content: '<base64, ' + formatBytes(base64Size(a.content)) + '>',
  })),
}, null, 2);

const TabPanel = ({ view, mail }) => {
  switch (view) {
  case 'html': return <HtmlPreview mail={mail} />;
  case 'plain': return <CodeBlock label="Plain text body" text={getContent(mail, 'text/plain') || ''} />;
  case 'template': return <TemplateData mail={mail} />;
  default: return <CodeBlock label="Raw mail JSON" text={rawJson(mail)} />;
  }
};

const Tabs = ({ views, active, onChange }) => {
  const refs = useRef({});

  const onKeyDown = event => {
    const index = views.findIndex(v => v.id === active);
    const next = {
      ArrowRight: (index + 1) % views.length,
      ArrowLeft: (index - 1 + views.length) % views.length,
      Home: 0,
      End: views.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(views[next].id);
    refs.current[views[next].id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Mail content" onKeyDown={onKeyDown}>
      {views.map(view => (
        <button
          key={view.id}
          ref={el => { refs.current[view.id] = el; }}
          type="button"
          role="tab"
          id={'tab-' + view.id}
          className="tab"
          aria-selected={view.id === active}
          aria-controls="mail-tabpanel"
          tabIndex={view.id === active ? 0 : -1}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
};

const MetaRow = ({ label, value, mono = true }) => (
  value ? (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </>
  ) : null
);

const MailViewer = ({ mail, onClose }) => {
  const dialogRef = useRef(null);
  const views = getAvailableViews(mail);
  const [active, setActive] = useState(views[0].id);
  const subject = getSubject(mail);
  const attachments = mail.attachments || [];

  // Native <dialog>: showModal() gives focus trapping, inert background and Escape.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  // A click on the dialog element itself (not its content) is a backdrop click.
  const onDialogClick = event => {
    if (event.target === dialogRef.current) dialogRef.current.close();
  };

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby="mail-title" onClick={onDialogClick}>
      <div className="dialog-inner">
        <header className="dialog-header">
          <h2 id="mail-title" className="dialog-title">
            {subject || <span className="muted">(no subject)</span>}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close"
            onClick={() => dialogRef.current.close()}
          >
            ×
          </button>
        </header>

        <div className="dialog-body">
          <dl className="meta">
            <MetaRow label="Date" mono={false} value={
              <time dateTime={mail.datetime} title={mail.datetime}>{formatDateTime(mail.datetime)}</time>
            } />
            <MetaRow label="From" value={getFrom(mail)} />
            <MetaRow label="To" value={getRecipientsByKind(mail, 'to').join(', ')} />
            <MetaRow label="Cc" value={getRecipientsByKind(mail, 'cc').join(', ')} />
            <MetaRow label="Bcc" value={getRecipientsByKind(mail, 'bcc').join(', ')} />
            <MetaRow label="Reply-to" value={mail.reply_to?.email} />
            <MetaRow label="Template" value={mail.template_id} />
          </dl>

          <Tabs views={views} active={active} onChange={setActive} />
          <div
            className="tab-panel"
            role="tabpanel"
            id="mail-tabpanel"
            aria-labelledby={'tab-' + active}
          >
            <TabPanel view={active} mail={mail} />
          </div>

          {attachments.length > 0 && (
            <section aria-labelledby="attachments-title">
              <h3 id="attachments-title" className="section-title">Attachments ({attachments.length})</h3>
              <ul className="attachments">
                {attachments.map((a, index) => (
                  <li key={index}>
                    <span className="mono">{a.filename || '(unnamed)'}</span>
                    <span className="muted">{a.type || 'unknown type'}</span>
                    <span className="muted">{formatBytes(base64Size(a.content))}</span>
                    {a.disposition === 'inline' && <span className="tag">inline</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default MailViewer;
