import React, { useEffect, useState } from 'react';

import { formatDateTime, getFrom, getRecipients, getSubject } from './mailUtils';

const PAGE_SIZES = [10, 20, 50, 100];

const Recipients = ({ mail }) => {
  const recipients = getRecipients(mail);
  if (recipients.length === 0) return <span className="muted">—</span>;

  return (
    <ul className="recipients mono">
      {recipients.map((r, index) => (
        <li key={r.kind + '-' + r.email + '-' + index}>
          {r.email}
          {r.kind !== 'to' && <span className="tag">{r.kind}</span>}
        </li>
      ))}
    </ul>
  );
};

const Pagination = ({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange }) => {
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="field field-inline">
        <label htmlFor="page-size">Rows per page</label>
        <select
          id="page-size"
          className="select"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </div>

      <div className="pagination-controls">
        <span>{first}–{last} of {total}</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  );
};

const MailTable = ({ mails, onOpen }) => {
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(mails.length / pageSize));

  // Keep the current page valid when the list shrinks (filters, delete).
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const visible = mails.slice(page * pageSize, (page + 1) * pageSize);

  const openFromRow = (mail, event) => {
    // Ignore clicks on interactive children (they handle themselves) and text selection.
    if (event.target.closest('button, a') || window.getSelection().toString()) return;
    onOpen(mail, event.currentTarget.querySelector('button'));
  };

  return (
    <>
      <div className="table-wrap">
        <table className="table table-stack" role="table">
          <caption className="visually-hidden">Sent mails, newest first</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Date</th>
              <th scope="col" role="columnheader" className="col-from">From</th>
              <th scope="col" role="columnheader">Recipients</th>
              <th scope="col" role="columnheader">Subject</th>
              <th scope="col" role="columnheader"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {visible.map((mail, index) => {
              const subject = getSubject(mail);
              return (
                <tr key={mail.datetime + '-' + page + '-' + index} role="row" onClick={e => openFromRow(mail, e)}>
                  <td role="cell" className="col-date">
                    <time dateTime={mail.datetime} title={mail.datetime}>{formatDateTime(mail.datetime)}</time>
                  </td>
                  <td role="cell" className="col-from mono">{getFrom(mail) || <span className="muted">—</span>}</td>
                  <td role="cell"><Recipients mail={mail} /></td>
                  <td role="cell" className="col-subject">
                    {subject || <span className="muted">(no subject{mail.template_id ? ' · template' : ''})</span>}
                  </td>
                  <td role="cell" className="col-action">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={e => onOpen(mail, e.currentTarget)}
                      aria-label={'View mail: ' + (subject || 'no subject')}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={mails.length}
        onPageChange={setPage}
        onPageSizeChange={size => { setPageSize(size); setPage(0); }}
      />
    </>
  );
};

export default MailTable;
