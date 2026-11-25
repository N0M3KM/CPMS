import { expect, it } from 'vitest';
import { searchQuerySchema } from '../src/search/policy.js';

it('TEST-84 parses search defaults and strict decimal boundaries', () => {
  expect(searchQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  expect(searchQuerySchema.parse({ q: '  proposal  ', page: '2', limit: '50' }))
    .toEqual({ q: 'proposal', page: 2, limit: 50 });
  expect(searchQuerySchema.parse({ limit: '1', q: 'x'.repeat(100) }).limit).toBe(1);
  for (const query of [{ q: 'x'.repeat(101) }, { q: ['a', 'b'] }, { limit: '51' }, { page: '0' }, { page: '1e2' }, { sort: 'title' }]) {
    expect(searchQuerySchema.safeParse(query).success).toBe(false);
  }
});
