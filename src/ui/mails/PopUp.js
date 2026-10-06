import React from 'react';

const SimpleContent = (content) => {
  return <div>{content}</div>;
};

const HtmlContent = (content, mailContext) => {

  const attachments = mailContext.attachments || [];

  const contentWithAttachedAttachments = attachments
    .filter(attachment => attachment.disposition === 'inline')
    .reduce((prevContent, attachment) => {
      return prevContent.replace(
        `cid:${attachment.content_id}`,
        `data:${attachment.type};base64, ${attachment.content}`
      );
    }, content);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: contentWithAttachedAttachments }}
    />
  );
};

const isEmpty = (value) => !value || Object.keys(value).length === 0;

const TemplateSection = (title, children) => (
  <div style={{ marginTop: '12px' }}>
    <div>
      <b>{title}:</b>
    </div>
    <div>{children}</div>
  </div>
);

const JsonBlock = (value) => (
  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
    {JSON.stringify(value, null, 2)}
  </pre>
);

const TemplateContent = (templateId, personalizations, mailContext) => {
  const from = mailContext && mailContext.from;
  const mailSubject = mailContext && mailContext.subject;

  return (
    <div>
      <b>{templateId}</b>

      {from ? TemplateSection('from', from.name ? `${from.name} <${from.email}>` : from.email) : null}

      {
        (personalizations || [])
          .map((p, index) => {
            const subject = mailSubject || p.subject;

            return (
              <div key={index}>
                {subject ? TemplateSection('subject', subject) : null}

                {TemplateSection(
                  'to',
                  <ul>
                    {(p.to || []).map(to => (<li key={to.email}>{to.email}</li>))}
                  </ul>
                )}

                {isEmpty(p.substitutions) ? null : TemplateSection(
                  'substitutions',
                  <table>
                    <tbody>
                      {Object.keys(p.substitutions).map(key => (
                        <tr key={key}>
                          <td style={{ paddingRight: '16px', verticalAlign: 'top' }}><code>{key}</code></td>
                          <td style={{ wordBreak: 'break-word' }}>{String(p.substitutions[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {isEmpty(p.dynamic_template_data) ? null : TemplateSection(
                  'template data',
                  JsonBlock(p.dynamic_template_data)
                )}

                {isEmpty(p.custom_args) ? null : TemplateSection('custom args', JsonBlock(p.custom_args))}
              </div>
            );
          })
      }
    </div>
  );
};

const PopUp = (props) => {

  const contentRenderer = {
    'text/plain': SimpleContent,
    'text/html': HtmlContent,
  };

  const renderCloseButton = () => {
    return (
      <span
        className="close"
        style={{ float: 'right', fontSize: '50px', marginRight: '20px' }}
        onClick={props.hide}
      >
        &times;
      </span>
    );
  };

  const renderContent = (type, content, mailContext) => {
    const renderer = contentRenderer[type];

    if (renderer) {
      return renderer(content, mailContext);
    } else {
      return <div>{''}</div>;
    }
  };

  const renderDisplayContent = (displayContent, selectedEmailType) => {
    if (Array.isArray(displayContent)) {
      return (
        <div>
          {displayContent.filter(content => content.type === selectedEmailType).map((content, index) => (
            <div key={index}>
              {
                renderContent(
                  content.type,
                  content.value,
                  props.currentEmail
                )
              }
            </div>
          ))}
        </div>
      );
    } else {
      return <div>{''}</div>;
    }
  };

  return (
    <div className="modal">
      <div className="modal_content">

        {renderCloseButton()}

        {props.currentEmail.template_id ?
          TemplateContent(
            props.currentEmail.template_id,
            props.currentEmail.personalizations,
            props.currentEmail
          ) :
          renderDisplayContent(props.currentEmail.displayContent, props.selectedEmailType)
        }

      </div>
    </div>
  );
};

export default PopUp;
