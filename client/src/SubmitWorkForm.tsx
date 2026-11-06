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

async function requestError(response: Response | null): Promise<string> {
  if (!response) return 'Could not submit your work. Try again.';
  if (response.status === 409) {
    const body: { error?: { code?: string } } | null = await response.json().catch(() => null);
    return body?.error?.code === 'DEADLINE_PASSED'
      ? 'The deadline for this milestone has passed.'
      : 'This milestone already has a submission.';
  }
  switch (response.status) {
    case 400: return 'Check the title, description and link.';
    case 401: return 'Your session has expired. Sign in and try again.';
    case 403: return 'Only students can submit work.';
    case 404: return 'This milestone is unavailable.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'Could not submit your work. Try again.';
  }
}

export function SubmitWorkForm({ milestoneId, onSubmitted }: { milestoneId: string; onSubmitted: () => void }) {
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
      const response = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, link }),
      });
      if (response.ok) {
        form.reset();
        onSubmitted();
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
    <section aria-labelledby="submit-work">
      <h4 id="submit-work">Submit your work</h4>
      <form aria-labelledby="submit-work" onSubmit={submit} noValidate>
        <fieldset className="milestone-fields" disabled={pending}>
          <label htmlFor="work-title">Title</label>
          <input id="work-title" name="title" required maxLength={100}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'work-title-error' : undefined} />
          {errors.title && <p id="work-title-error" className="error" role="alert">{errors.title}</p>}
          <label htmlFor="work-description">Description</label>
          <textarea id="work-description" name="description" required maxLength={2000} rows={5}
            aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'work-description-error' : undefined} />
          {errors.description && <p id="work-description-error" className="error" role="alert">{errors.description}</p>}
          <label htmlFor="work-link">Link</label>
          <input id="work-link" name="link" type="url" required maxLength={MAX_LINK} inputMode="url"
            aria-invalid={Boolean(errors.link)} aria-describedby={errors.link ? 'work-link-error' : undefined} />
          {errors.link && <p id="work-link-error" className="error" role="alert">{errors.link}</p>}
          {apiError && <p className="error" role="alert">{apiError}</p>}
          <button type="submit">{pending ? 'Submitting…' : 'Submit work'}</button>
        </fieldset>
      </form>
    </section>
  );
}
