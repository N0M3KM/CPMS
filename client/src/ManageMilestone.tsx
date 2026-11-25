import { useState, type FormEvent } from 'react';

type Action = 'save' | 'close';
type Fields = 'title' | 'description' | 'dueAt';
type FieldErrors = Partial<Record<Fields | 'form', string>>;
type Props = {
  milestone: { id: string; title: string; description: string; dueAt: string };
  onChanged: () => void;
};

// The value a datetime-local input expects, in local time.
function localInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body: { error?: { code?: string } } = await response.json();
    return body.error?.code ?? '';
  } catch {
    return '';
  }
}

// Plain sentences for every failure. The two 409 codes also reload the milestone (see `send`).
function requestError(status: number | null, code: string, action: Action): string {
  if (code === 'MILESTONE_CLOSED') return 'This milestone was closed, so it can no longer be edited.';
  if (code === 'ALREADY_CLOSED') return 'This milestone was already closed.';
  switch (status) {
    case 400: return 'Check the milestone fields and choose a future due date.';
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'You do not have permission to change this milestone.';
    case 404: return 'This milestone is unavailable.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return action === 'save' ? 'Could not save the changes. Try again.' : 'Could not close the milestone. Try again.';
  }
}

export function ManageMilestone({ milestone, onChanged }: Props) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);
  const initialDue = localInputValue(milestone.dueAt);

  async function send(path: string, method: 'PATCH' | 'POST', body: object, action: Action) {
    setPending(action);
    setApiError('');
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) {
        onChanged();
        return;
      }
      const code = await errorCode(response);
      setApiError(requestError(response.status, code, action));
      if (code === 'MILESTONE_CLOSED' || code === 'ALREADY_CLOSED') onChanged();
    } catch {
      setApiError(requestError(null, '', action));
    } finally {
      setPending(null);
      setConfirming(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending !== null) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get('title') ?? '').trim();
    const description = String(fields.get('description') ?? '');
    const dueValue = String(fields.get('dueAt') ?? '');
    const dueAt = new Date(dueValue);
    const nextErrors: FieldErrors = {};
    if (title.length < 5 || title.length > 100) nextErrors.title = 'Enter a title of 5 to 100 characters.';
    if (description.length > 1000) nextErrors.description = 'Use 1000 characters or fewer.';
    // Only a changed due date must be in the future, so a past milestone can still get a new title.
    const dueChanged = dueValue !== initialDue;
    if (dueChanged && !(dueAt.getTime() > Date.now())) nextErrors.dueAt = 'Choose a future date and time.';
    // Send only what changed, so an untouched past due date is never sent back.
    const changes: Record<string, string> = {};
    if (title !== milestone.title) changes.title = title;
    if (description !== milestone.description) changes.description = description;
    if (dueChanged && !nextErrors.dueAt) changes.dueAt = dueAt.toISOString();
    if (Object.keys(nextErrors).length === 0 && Object.keys(changes).length === 0) nextErrors.form = 'Change at least one field.';
    setErrors(nextErrors);
    setApiError('');
    if (Object.keys(nextErrors).length > 0) return;
    void send(`/api/milestones/${encodeURIComponent(milestone.id)}`, 'PATCH', changes, 'save');
  }

  return (
    <section aria-labelledby="edit-milestone">
      <h3 id="edit-milestone">Edit milestone</h3>
      <form aria-labelledby="edit-milestone" onSubmit={save} noValidate>
        <fieldset className="milestone-fields" disabled={pending !== null}>
          <label htmlFor="edit-title">Title (5 to 100 characters)</label>
          <input id="edit-title" name="title" required maxLength={100} defaultValue={milestone.title}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'edit-title-error' : undefined} />
          {errors.title && <p id="edit-title-error" className="error" role="alert">{errors.title}</p>}
          <label htmlFor="edit-description">Description (0 to 1000 characters)</label>
          <textarea id="edit-description" name="description" maxLength={1000} rows={4} defaultValue={milestone.description}
            aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'edit-description-error' : undefined} />
          {errors.description && <p id="edit-description-error" className="error" role="alert">{errors.description}</p>}
          <label htmlFor="edit-due">Due date and time (local, in the future)</label>
          <input id="edit-due" name="dueAt" type="datetime-local" required defaultValue={initialDue}
            aria-invalid={Boolean(errors.dueAt)} aria-describedby={errors.dueAt ? 'edit-due-error' : undefined} />
          {errors.dueAt && <p id="edit-due-error" className="error" role="alert">{errors.dueAt}</p>}
          {errors.form && <p className="error" role="alert">{errors.form}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending === 'save' ? 'Saving…' : 'Save changes'}</button>
        </fieldset>
      </form>

      <h3>Close milestone</h3>
      {confirming ? (
        <div role="group" aria-label="Confirm close">
          <p>Closing cannot be undone. Students can no longer submit work for this milestone, and it cannot be edited.</p>
          <button type="button" disabled={pending !== null}
            onClick={() => void send(`/api/milestones/${encodeURIComponent(milestone.id)}/close`, 'POST', {}, 'close')}>
            {pending === 'close' ? 'Closing…' : 'Yes, close this milestone'}
          </button>
          {' '}<button type="button" disabled={pending !== null} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" disabled={pending !== null} onClick={() => setConfirming(true)}>Close milestone</button>
      )}
    </section>
  );
}
