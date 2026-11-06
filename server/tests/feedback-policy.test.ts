import { describe, expect, it } from 'vitest';
import { feedbackSchema } from '../src/feedback/policy.js';

describe('feedbackSchema (BR-05)', () => {
  it('accepts 10 and 2000 characters after trimming', () => {
    expect(feedbackSchema.safeParse({ comment: 'c'.repeat(10) }).success).toBe(true);
    expect(feedbackSchema.safeParse({ comment: 'c'.repeat(2000) }).success).toBe(true);
    expect(feedbackSchema.safeParse({ comment: '   ' + 'c'.repeat(2000) + '   ' }).success).toBe(true);
  });

  it('trims the stored comment', () => {
    const parsed = feedbackSchema.safeParse({ comment: '   Good structure overall.   ' });
    expect(parsed.success && parsed.data.comment).toBe('Good structure overall.');
  });

  it.each([
    ['missing', {}],
    ['empty', { comment: '' }],
    ['whitespace only', { comment: ' '.repeat(40) }],
    ['9 characters', { comment: 'c'.repeat(9) }],
    ['9 characters padded with spaces', { comment: '  ' + 'c'.repeat(9) + '  ' }],
    ['2001 characters', { comment: 'c'.repeat(2001) }],
    ['NUL character', { comment: 'Good work\u0000 overall' }],
    ['escape character', { comment: 'Good work\u001B[31m overall' }],
    ['number', { comment: 12345678901 }],
    ['object', { comment: { $ne: null } }],
    ['unknown field supervisorId', { comment: 'Good structure overall.', supervisorId: 'x' }],
    ['unknown field submissionId', { comment: 'Good structure overall.', submissionId: 'x' }],
    ['unknown field createdAt', { comment: 'Good structure overall.', createdAt: '2020-01-01T00:00:00Z' }],
    ['unknown field id', { comment: 'Good structure overall.', id: 'x' }],
  ])('rejects %s', (_name, body) => {
    expect(feedbackSchema.safeParse(body).success).toBe(false);
  });

  it('allows newlines and tabs inside a comment', () => {
    expect(feedbackSchema.safeParse({ comment: 'Point one.\nPoint two.\twith a tab.' }).success).toBe(true);
  });
});
