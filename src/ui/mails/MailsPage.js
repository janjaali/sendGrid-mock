import React, { useCallback, useEffect, useRef, useState } from 'react';

import DeleteAllButton from './DeleteAllButton';
import MailFilters from './MailFilters';
import MailTable from './MailTable';
import MailViewer from './MailViewer';
import { EmptyState, ErrorState, SkeletonRows } from './StateViews';
import { useMails } from './useMails';
import { useDebouncedValue, useUrlFilters } from './useUrlFilters';

const AUTO_REFRESH_MS = 5000;
const API_PAGE_SIZE = 100;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const MailsPage = () => {
  const { filters, setFilter, clearFilters, hasFilters } = useUrlFilters();
  const debouncedFilters = useDebouncedValue(filters, 300);
  const { mails, isLoading, error, lastUpdated, refresh, deleteAll } = useMails(debouncedFilters);

  const [selected, setSelected] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const triggerRef = useRef(null);

  const openMail = useCallback((mail, trigger) => {
    triggerRef.current = trigger;
    setSelected(mail);
  }, []);

  const closeMail = useCallback(() => setSelected(null), []);

  // Return focus to the "View" button that opened the dialog once it is gone.
  useEffect(() => {
    if (!selected && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [selected]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const count = mails ? mails.length : 0;

  let statusText = '';
  if (mails === null && isLoading) statusText = 'Loading mails…';
  else if (mails !== null) statusText = `${count} mail${count === 1 ? '' : 's'}${hasFilters ? ' match' : ''}`;

  let body;
  if (mails === null && error) body = <ErrorState message={error} onRetry={refresh} />;
  else if (mails === null) body = <SkeletonRows />;
  else if (mails.length === 0) body = <EmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />;
  else body = <MailTable mails={mails} onOpen={openMail} />;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          sendgrid-mock <span className="muted">· Sent mails</span>
        </h1>
        <DeleteAllButton
          onDelete={deleteAll}
          count={count}
          hasFilters={hasFilters}
          disabled={mails === null || (count === 0 && !hasFilters)}
        />
      </header>

      <main>
        <MailFilters filters={filters} onChange={setFilter} onClear={clearFilters} hasFilters={hasFilters} />

        <div className="status-line">
          <p role="status" aria-live="polite">
            {statusText}
            {count >= API_PAGE_SIZE && ` (showing the latest ${API_PAGE_SIZE})`}
            {isLoading && mails !== null && <span className="muted"> · Refreshing…</span>}
          </p>
          <div className="toolbar">
            {lastUpdated && (
              <span className="muted">
                Updated <time dateTime={lastUpdated.toISOString()}>{timeFormat.format(lastUpdated)}</time>
              </span>
            )}
            <label className="checkbox">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button type="button" className="btn" onClick={refresh}>
              Refresh
            </button>
          </div>
        </div>

        {error && mails !== null && (
          <p className="banner feedback-error" role="alert">
            Refresh failed: {error}{' '}
            <button type="button" className="btn btn-sm" onClick={refresh}>Try again</button>
          </p>
        )}

        <section className="panel" aria-label="Mails">
          {body}
        </section>
      </main>

      {selected && <MailViewer mail={selected} onClose={closeMail} />}
    </div>
  );
};

export default MailsPage;
