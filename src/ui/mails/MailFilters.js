import React from 'react';

const MailFilters = ({ filters, onChange, onClear, hasFilters }) => {
  const handleChange = event => onChange(event.target.name, event.target.value);

  return (
    <form className="filters panel" role="search" aria-label="Filter mails" onSubmit={e => e.preventDefault()}>
      <div className="field">
        <label htmlFor="filter-subject">Subject contains</label>
        <input
          id="filter-subject"
          name="subject"
          type="search"
          className="input"
          autoComplete="off"
          value={filters.subject}
          onChange={handleChange}
        />
      </div>

      <div className="field">
        <label htmlFor="filter-to">Recipient (to) contains</label>
        <input
          id="filter-to"
          name="to"
          type="search"
          className="input mono"
          autoComplete="off"
          spellCheck="false"
          value={filters.to}
          onChange={handleChange}
        />
      </div>

      <div className="field">
        <label htmlFor="filter-since">Sent after</label>
        <input
          id="filter-since"
          name="dateTimeSince"
          type="datetime-local"
          className="input"
          value={filters.dateTimeSince}
          onChange={handleChange}
        />
      </div>

      <button type="button" className="btn btn-ghost" onClick={onClear} disabled={!hasFilters}>
        Clear filters
      </button>

      <p className="filters-hint">
        Matching is case-insensitive. Filters are saved in the URL, so you can share or bookmark this view.
      </p>
    </form>
  );
};

export default MailFilters;
