import { useCallback, useEffect, useState } from 'react';

import { isoToLocalInput, localInputToIso } from './mailUtils';

export const EMPTY_FILTERS = { subject: '', to: '', dateTimeSince: '' };

// Filters live in the URL (?subject=&to=&dateTimeSince=) so a filtered view
// can be shared and survives a reload. `dateTimeSince` is kept in state in
// the local format used by <input type="datetime-local"> and written to the
// URL as ISO-8601.
const readFiltersFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    subject: params.get('subject') || '',
    to: params.get('to') || '',
    dateTimeSince: isoToLocalInput(params.get('dateTimeSince')),
  };
};

const writeFiltersToUrl = filters => {
  const params = new URLSearchParams(window.location.search);
  const urlValues = { ...filters, dateTimeSince: localInputToIso(filters.dateTimeSince) };

  Object.keys(urlValues).forEach(key => {
    if (urlValues[key]) params.set(key, urlValues[key]);
    else params.delete(key);
  });

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
};

export const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

export const useUrlFilters = () => {
  const [filters, setFilters] = useState(readFiltersFromUrl);

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const setFilter = useCallback((name, value) => {
    setFilters(previous => ({ ...previous, [name]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const hasFilters = Object.keys(filters).some(key => filters[key]);

  return { filters, setFilter, clearFilters, hasFilters };
};
