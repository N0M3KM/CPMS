import { useState, type FormEvent } from 'react';

const MIN = 10;
const MAX = 2000;
// Same rule as the server: control characters are refused, tab and newline are allowed.
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

async function requestError(response: Response | null): Promise<string> {
  if (!response) return 'Could not save the feedback. Try again.';
  switch (response.status) {
    case 400: return `Write feedback of ${MIN} to ${MAX} characters.`;
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'Only supervisors can give feedback.';
    case 404: return 'This submission is unavailable.';
    case 409: return 'This submission already has feedback.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'Could not save the feedback. Try again.';
  }
}

export function FeedbackForm({ submissionId, onSaved }: { submissionId: string; onSaved: () => void }) {
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const comment = String(new FormData(form).get('comment') ?? '').trim();
    const message =
      comment.length < MIN || comment.length > MAX || CONTROL_EXCEPT_WHITESPACE.test(comment)
        ? `Enter feedback of ${MIN} to ${MAX} characters.`
        : '';
    setError(message);
    setApiError('');
    if (message) return;

    setPending(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (response.ok) {
        form.reset();
        onSaved();
      } else {
        setApiError(await requestError(response));
      }
    } catch {
      setApiError(await requestError(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="give-feedback">
      <h4 id="give-feedback">Give feedback</h4>
      <form aria-labelledby="give-feedback" onSubmit={submit} noValidate>
        <fieldset className="milestone-fields" disabled={pending}>
          <label htmlFor="feedback-comment">Feedback</label>
          <textarea id="feedback-comment" name="comment" required maxLength={MAX} rows={5}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'feedback-comment-error' : undefined} />
          {error && <p id="feedback-comment-error" className="error" role="alert">{error}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending ? 'Saving…' : 'Save feedback'}</button>
        </fieldset>
      </form>
    </section>
  );
}
