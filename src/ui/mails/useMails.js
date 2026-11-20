import { useCallback, useEffect, useRef, useState } from 'react';

import { localInputToIso, toContainsPattern } from './mailUtils';

const FILTER_KEYS = ['subject', 'to', 'dateTimeSince'];

// Builds the /api/mails query. Non-filter params from the page URL (e.g.
// pageSize) are passed through, as before, so existing deep links keep working.
export const buildMailsQuery = (filters, search = window.location.search) => {
  const params = new URLSearchParams('page=1&pageSize=100');

  new URLSearchParams(search).forEach((value, key) => {
    if (!FILTER_KEYS.includes(key)) params.set(key, value);
  });

  const subject = toContainsPattern(filters.subject);
  const to = toContainsPattern(filters.to);
  const dateTimeSince = localInputToIso(filters.dateTimeSince);

  if (subject) params.set('subject', subject);
  if (to) params.set('to', to);
  if (dateTimeSince) params.set('dateTimeSince', dateTimeSince);

  return params.toString();
};

const describeHttpError = response =>
  `The server responded with ${response.status} ${response.statusText}`.trim();

// Loads mails for the given filters.
// - `mails` is null until the first successful load, so callers can tell
//   "never loaded" (show skeleton) from "loaded, but empty".
// - Stale responses are aborted when filters change or on refresh.
export const useMails = filters => {
  const [mails, setMails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const controllerRef = useRef(null);

  const query = buildMailsQuery(filters);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetch(`/api/mails?${query}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(describeHttpError(response));
        return response.json();
      })
      .then(data => {
        setMails(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
        setIsLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Could not load mails.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [query, reloadToken]);

  const refresh = useCallback(() => setReloadToken(token => token + 1), []);

  // Deletes every stored mail (the API has no "delete filtered" for subject/date).
  const deleteAll = useCallback(() =>
    fetch('/api/mails', { method: 'DELETE' }).then(response => {
      if (response.status !== 202) throw new Error(describeHttpError(response));
      setMails([]);
      setLastUpdated(new Date());
    }), []);

  return { mails, isLoading, error, lastUpdated, refresh, deleteAll };
};
