import React, { useEffect, useRef, useState } from 'react';

// Two-step destructive action with visible feedback.
const DeleteAllButton = ({ onDelete, count, hasFilters, disabled }) => {
  const [step, setStep] = useState('idle'); // idle | confirming | deleting
  const [feedback, setFeedback] = useState(null); // { kind, text }
  const cancelRef = useRef(null);

  useEffect(() => {
    if (step === 'confirming') cancelRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (feedback?.kind !== 'success') return undefined;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const confirm = () => {
    setStep('deleting');
    onDelete()
      .then(() => setFeedback({ kind: 'success', text: 'All mails deleted.' }))
      .catch(err => setFeedback({ kind: 'error', text: `Delete failed: ${err.message}` }))
      .then(() => setStep('idle'));
  };

  const question = hasFilters
    ? 'Delete all stored mails, not only the ones shown?'
    : `Delete all ${count} mail${count === 1 ? '' : 's'}?`;

  return (
    <div className="confirm">
      {step === 'idle' ? (
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => { setFeedback(null); setStep('confirming'); }}
          disabled={disabled}
        >
          Delete all…
        </button>
      ) : (
        <>
          <span id="delete-question">{question}</span>
          <button
            type="button"
            className="btn btn-danger-solid"
            onClick={confirm}
            disabled={step === 'deleting'}
            aria-describedby="delete-question"
          >
            {step === 'deleting' ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            className="btn"
            ref={cancelRef}
            onClick={() => setStep('idle')}
            disabled={step === 'deleting'}
          >
            Cancel
          </button>
        </>
      )}
      <span role="status" className={'feedback' + (feedback ? ' feedback-' + feedback.kind : '')}>
        {feedback?.text}
      </span>
    </div>
  );
};

export default DeleteAllButton;
