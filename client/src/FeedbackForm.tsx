import { useState, type FormEvent } from 'react';

const MIN = 10;
const MAX = 2000;
// Same rule as the server: control characters are refused, tab and newline are allowed.
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// `stale` means the server refused because a newer version exists: the view should show it, and the draft stays.
async function requestError(response: Response | null): Promise<{ message: string; stale: boolean }> {
  const plain = (message: string) => ({ message, stale: false });
  if (!response) return plain('Could not save the feedback. Try again.');
  switch (response.status) {
    case 400: return plain(`Write feedback of ${MIN} to ${MAX} characters.`);
    case 401: return plain('Your session has expired. Sign in and try again.');
    case 403: return plain('Only supervisors can give feedback.');
    case 404: return plain('This submission is unavailable.');
    case 409: {
      const body: { error?: { code?: string } } | null = await response.json().catch(() => null);
      if (body?.error?.code === 'REVISION_SUPERSEDED') {
        return { stale: true, message: 'The team sent a newer version while you were writing. Your draft is kept: read the new version above, then save again.' };
      }
      return plain('This submission already has feedback.');
    }
    case 429: return plain('Too many requests. Wait a moment and try again.');
    default: return plain('Could not save the feedback. Try again.');
  }
}

// onStale refreshes the surrounding view in place (the form and its draft stay mounted).
export function FeedbackForm({ submissionId, onSaved, onStale }: { submissionId: string; onSaved: () => void; onStale?: () => void }) {
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
        const failure = await requestError(response);
        setApiError(failure.message);
        if (failure.stale) onStale?.();
      }
    } catch {
      setApiError((await requestError(null)).message);
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
