import { describe, expect, it } from 'vitest';
import { isPastDue } from '../src/domain/deadline.js';
import { AppError } from '../src/platform/errors.js';
import { assertBeforeDeadline, isAllowedLink, submissionSchema } from '../src/submissions/policy.js';

const valid = { title: 'Design report', description: 'd'.repeat(20), link: 'https://example.test/report' };
const dueAt = new Date('2026-11-22T12:00:00Z');

describe('isPastDue (shared deadline rule)', () => {
  it('is false before and exactly at the deadline, true one millisecond later', () => {
    expect(isPastDue(dueAt, new Date(dueAt.getTime() - 1000))).toBe(false);
    expect(isPastDue(dueAt, dueAt)).toBe(false);
    expect(isPastDue(dueAt, new Date(dueAt.getTime() + 1))).toBe(true);
  });
});

describe('assertBeforeDeadline (BR-02)', () => {
  it('accepts before and at the deadline', () => {
    expect(() => assertBeforeDeadline(dueAt, new Date(dueAt.getTime() - 1000))).not.toThrow();
    expect(() => assertBeforeDeadline(dueAt, dueAt)).not.toThrow();
  });
  it('rejects after the deadline with 409 DEADLINE_PASSED', () => {
    const err = (() => {
      try {
        assertBeforeDeadline(dueAt, new Date(dueAt.getTime() + 1000));
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect((err as AppError).code).toBe('DEADLINE_PASSED');
  });
});

describe('isAllowedLink (BR-04)', () => {
  it.each(['https://example.test/a', 'http://example.test', 'HTTPS://EXAMPLE.TEST/Path?q=1#frag', 'https://example.test:8443/x'])(
    'accepts %s',
    (link) => expect(isAllowedLink(link)).toBe(true),
  );
  it.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'ftp://example.test/x',
    'mailto:a@example.test', '/relative/path', '//evil.example/x', 'example.test/report', '', 'https://', 'http:///nohost',
    'https://exa mple.test', 'https://example.test/\u0000', 'https://example.test/\nx', ' https://example.test', 'https://user:pw@example.test',
  ])('rejects %j', (link) => expect(isAllowedLink(link)).toBe(false));
  it('accepts 500 characters and rejects 501', () => {
    const base = 'https://example.test/';
    expect(isAllowedLink(base + 'a'.repeat(500 - base.length))).toBe(true);
    expect(isAllowedLink(base + 'a'.repeat(501 - base.length))).toBe(false);
  });
});

describe('submissionSchema (BR-04)', () => {
  it('accepts the boundary lengths', () => {
    expect(submissionSchema.safeParse({ ...valid, title: 'T'.repeat(5), description: 'd'.repeat(20) }).success).toBe(true);
    expect(submissionSchema.safeParse({ ...valid, title: 'T'.repeat(100), description: 'd'.repeat(2000) }).success).toBe(true);
  });
  it.each([
    ['title too short', { title: 'abcd' }],
    ['title too long', { title: 'T'.repeat(101) }],
    ['title blank after trim', { title: '        ' }],
    ['description too short', { description: 'd'.repeat(19) }],
    ['description too long', { description: 'd'.repeat(2001) }],
    ['missing link', { link: undefined }],
    ['non-string title', { title: 7 }],
    ['unknown field', { submittedById: 'x' }],
    ['unknown field milestoneId', { milestoneId: 'x' }],
    ['NUL in title', { title: 'Design\u0000report' }],
    ['NUL in description', { description: 'd'.repeat(30) + '\u0000' }],
    ['javascript link', { link: 'javascript:alert(1)' }],
  ])('rejects %s', (_name, patch) => {
    expect(submissionSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('allows newlines and tabs in the description but not in the title', () => {
    expect(submissionSchema.safeParse({ ...valid, description: 'Line one\nLine two\twith tab and more' }).success).toBe(true);
    expect(submissionSchema.safeParse({ ...valid, title: 'Design\nreport' }).success).toBe(false);
  });
  it('trims the title before measuring it', () => {
    const parsed = submissionSchema.safeParse({ ...valid, title: '  Design report  ' });
    expect(parsed.success && parsed.data.title).toBe('Design report');
  });
});
