import React from 'react';

const SKELETON_ROWS = 5;
const SKELETON_WIDTHS = ['70%', '85%', '60%', '90%', '75%'];

export const SkeletonRows = () => (
  <div className="table-wrap" aria-busy="true">
    <table className="table">
      <caption className="visually-hidden">Loading mails</caption>
      <tbody>
        {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
          <tr key={row}>
            {[0, 1, 2, 3].map(col => (
              <td key={col}>
                <span className="skeleton" style={{ width: SKELETON_WIDTHS[(row + col) % SKELETON_WIDTHS.length] }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="state state-error" role="alert">
    <p className="state-title">Couldn’t load mails</p>
    <p>{message}</p>
    <button type="button" className="btn" onClick={onRetry}>Try again</button>
  </div>
);

const SAMPLE_REQUEST = `curl -X POST http://localhost:3000/v3/mail/send \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"personalizations":[{"to":[{"email":"to@example.com"}]}],
       "from":{"email":"from@example.com"},"subject":"Hello",
       "content":[{"type":"text/plain","value":"Hi!"}]}'`;

export const EmptyState = ({ hasFilters, onClearFilters }) => (
  hasFilters ? (
    <div className="state">
      <p className="state-title">No mails match these filters</p>
      <p>Try a shorter search term or an earlier date.</p>
      <button type="button" className="btn" onClick={onClearFilters}>Clear filters</button>
    </div>
  ) : (
    <div className="state">
      <p className="state-title">No mails yet</p>
      <p>Mails sent to this mock show up here. Send one to try it out:</p>
      <pre><code>{SAMPLE_REQUEST}</code></pre>
    </div>
  )
);
