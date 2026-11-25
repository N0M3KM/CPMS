import { useState, type FormEvent } from 'react';

type FieldErrors = Partial<Record<'title' | 'description' | 'link', string>>;

const MAX_LINK = 500;
// Same control-character rules as the server (title and link: none; description: tab and newline allowed).
const CONTROL = /[\u0000-\u001F\u007F]/;
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function validLink(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LINK || /\s/.test(value) || CONTROL.test(value)) return false;
  if (!/^https?:\/\/[^/]/i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

const conflictMessages: Record<string, string> = {
  NO_SUBMISSION: 'Submit the first version before sending a new one.',
  MILESTONE_CLOSED: 'This milestone is closed.',
  DEADLINE_PASSED: 'The deadline for this milestone has passed.',
  REVISION_LIMIT: 'This milestone already has the most versions allowed (5).',
  REVISION_CONFLICT: 'Another version was saved at the same time. Reload and try again.',
};

async function requestError(response: Response | null): Promise<string> {
  if (!response) return 'Could not send the new version. Try again.';
  if (response.status === 409) {
    const body: { error?: { code?: string } } | null = await response.json().catch(() => null);
    return conflictMessages[body?.error?.code ?? ''] ?? 'Could not send the new version. Try again.';
  }
  switch (response.status) {
    case 400: return 'Check the title, description and link.';
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'Only students can send a new version.';
    case 404: return 'This milestone is unavailable.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'Could not send the new version. Try again.';
  }
}

export function ReviseWorkForm({ milestoneId, onRevised }: { milestoneId: string; onRevised: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get('title') ?? '').trim();
    const description = String(fields.get('description') ?? '').trim();
    const link = String(fields.get('link') ?? '');
    const nextErrors: FieldErrors = {};
    if (title.length < 5 || title.length > 100 || CONTROL.test(title)) nextErrors.title = 'Enter a title of 5 to 100 characters.';
    if (description.length < 20 || description.length > 2000 || CONTROL_EXCEPT_WHITESPACE.test(description)) {
      nextErrors.description = 'Enter a description of 20 to 2000 characters.';
    }
    if (!validLink(link)) nextErrors.link = 'Enter a link that starts with http:// or https:// (500 characters at most).';
    setErrors(nextErrors);
    setApiError('');
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      const response = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, link }),
      });
      if (response.ok) {
        form.reset();
        onRevised();
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
    <section aria-labelledby="revise-work">
      <h4 id="revise-work">Send a new version</h4>
      <form aria-labelledby="revise-work" onSubmit={submit} noValidate>
        <fieldset className="milestone-fields" disabled={pending}>
          <label htmlFor="revise-title">Title</label>
          <input id="revise-title" name="title" required maxLength={100}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'revise-title-error' : undefined} />
          {errors.title && <p id="revise-title-error" className="error" role="alert">{errors.title}</p>}
          <label htmlFor="revise-description">Description</label>
          <textarea id="revise-description" name="description" required maxLength={2000} rows={5}
            aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'revise-description-error' : undefined} />
          {errors.description && <p id="revise-description-error" className="error" role="alert">{errors.description}</p>}
          <label htmlFor="revise-link">Link</label>
          <input id="revise-link" name="link" type="url" required maxLength={MAX_LINK} inputMode="url"
            aria-invalid={Boolean(errors.link)} aria-describedby={errors.link ? 'revise-link-error' : undefined} />
          {errors.link && <p id="revise-link-error" className="error" role="alert">{errors.link}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending ? 'Sending…' : 'Send new version'}</button>
        </fieldset>
      </form>
    </section>
  );
}
