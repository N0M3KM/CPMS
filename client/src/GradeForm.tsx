import { useState, type FormEvent } from 'react';

const MIN = 0;
const MAX = 100;

async function requestError(response: Response | null): Promise<string> {
  if (!response) return 'Could not save the grade. Try again.';
  switch (response.status) {
    case 400: return `Enter a whole number from ${MIN} to ${MAX}.`;
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'Only supervisors can grade.';
    case 404: return 'This submission is unavailable.';
    case 409: {
      const body: { error?: { code?: string } } | null = await response.json().catch(() => null);
      switch (body?.error?.code) {
        case 'FEEDBACK_REQUIRED': return 'Give feedback before grading.';
        case 'REVISION_SUPERSEDED': return 'A newer revision was submitted. Only the latest revision can be graded.';
        default: return 'This submission already has a grade.';
      }
    }
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'Could not save the grade. Try again.';
  }
}

// Shown to a supervisor on the current revision once it has feedback and no grade. After a save it shows the
// saved score itself; pass onSaved to reload the surrounding view as well.
export function GradeForm({ submissionId, onSaved }: { submissionId: string; onSaved?: () => void }) {
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const raw = String(new FormData(event.currentTarget).get('score') ?? '').trim();
    const score = Number(raw);
    const message = raw === '' || !Number.isInteger(score) || score < MIN || score > MAX
      ? `Enter a whole number from ${MIN} to ${MAX}.`
      : '';
    setError(message);
    setApiError('');
    if (message) return;

    setPending(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      if (response.ok) {
        setSaved(score);
        onSaved?.();
      } else {
        setApiError(await requestError(response));
      }
    } catch {
      setApiError(await requestError(null));
    } finally {
      setPending(false);
    }
  }

  if (saved !== null) return <p>Grade: {saved} / {MAX}</p>;

  return (
    <section aria-labelledby="give-grade">
      <h4 id="give-grade">Give a grade</h4>
      <form aria-labelledby="give-grade" onSubmit={submit} noValidate>
        <fieldset className="milestone-fields" disabled={pending}>
          <label htmlFor="grade-score">Score (0 to {MAX})</label>
          <input id="grade-score" name="score" type="number" inputMode="numeric" min={MIN} max={MAX} step={1} required
            aria-invalid={Boolean(error)} aria-describedby={error ? 'grade-score-error' : undefined} />
          {error && <p id="grade-score-error" className="error" role="alert">{error}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending ? 'Saving…' : 'Save grade'}</button>
        </fieldset>
      </form>
    </section>
  );
}
