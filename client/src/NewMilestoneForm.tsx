import { useState, type FormEvent } from 'react';

type FieldErrors = Partial<Record<'title' | 'description' | 'dueAt', string>>;

function requestError(status: number): string {
  switch (status) {
    case 400: return 'Check the milestone fields and choose a future due date.';
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'You do not have permission to create milestones.';
    case 404: return 'This team is unavailable.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'Could not create the milestone. Try again.';
  }
}

export function NewMilestoneForm({ teamId, onCreated }: { teamId: string; onCreated: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get('title') ?? '').trim();
    const description = String(fields.get('description') ?? '');
    const dueAt = new Date(String(fields.get('dueAt') ?? ''));
    const nextErrors: FieldErrors = {};
    if (title.length < 5 || title.length > 100) nextErrors.title = 'Enter a title of 5 to 100 characters.';
    if (description.length > 1000) nextErrors.description = 'Use 1000 characters or fewer.';
    if (!(dueAt.getTime() > Date.now())) nextErrors.dueAt = 'Choose a future date and time.';
    setErrors(nextErrors);
    setApiError('');
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, dueAt: dueAt.toISOString() }),
      });
      if (response.ok) {
        onCreated();
      } else {
        setApiError(requestError(response.status));
      }
    } catch {
      setApiError(requestError(0));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="new-milestone">
      <h3 id="new-milestone">New milestone</h3>
      <form aria-labelledby="new-milestone" onSubmit={submit} noValidate>
        <fieldset className="milestone-fields" disabled={pending}>
          <label htmlFor="milestone-title">Title</label>
          <input id="milestone-title" name="title" required maxLength={100}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'milestone-title-error' : undefined} />
          {errors.title && <p id="milestone-title-error" className="error" role="alert">{errors.title}</p>}
          <label htmlFor="milestone-description">Description (optional)</label>
          <textarea id="milestone-description" name="description" maxLength={1000} rows={4}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'milestone-description-error' : undefined} />
          {errors.description && <p id="milestone-description-error" className="error" role="alert">{errors.description}</p>}
          <label htmlFor="milestone-due">Due date and time (local)</label>
          <input id="milestone-due" name="dueAt" type="datetime-local" required
            aria-invalid={Boolean(errors.dueAt)} aria-describedby={errors.dueAt ? 'milestone-due-error' : undefined} />
          {errors.dueAt && <p id="milestone-due-error" className="error" role="alert">{errors.dueAt}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending ? 'Creating…' : 'Create milestone'}</button>
        </fieldset>
      </form>
    </section>
  );
}
