import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id, validSubmission } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

const prisma = createTestPrisma();
const fx = createApiFixture(prisma);
const path = '/api/search';
const studentA = () => fx.login('student.a1@example.test');
const studentB = () => fx.login('student.b1@example.test');
const supervisor1 = () => fx.login('supervisor1@example.test');
const supervisor2 = () => fx.login('supervisor2@example.test');
const get = (cookie: string, query: Record<string, string | number> = {}) => fx.as(cookie).get(path).query(query);
const ids = (body: { items: { id: string }[] }) => body.items.map(item => item.id);
const row = (n: number, title: string, dueAt = fx.clock.now(), team = 101) => ({
  id: id(n), title, description: 'Synthetic fixture for search.', dueAt, teamId: id(team), createdById: id(1),
});

beforeEach(() => fx.reset());
afterAll(() => prisma.$disconnect());

describe('F-12 scoped milestone search', () => {
  it('TEST-79 searches titles case-insensitively and returns only the student team', async () => {
    const a = await studentA();
    const b = await studentB();
    const found = await get(a, { q: '  PROPOSAL  ' }).expect(200).expect('Cache-Control', 'no-store');
    expect(found.body).toEqual({
      items: [{ id: id(201), teamId: id(101), title: 'Project proposal draft', dueAt: expect.any(String), status: 'REVIEWED' }],
      total: 1, page: 1, limit: 20,
    });
    expect(ids((await get(a, { q: 'prototype' }).expect(200)).body)).toEqual([id(202)]);
    expect(ids((await get(a).expect(200)).body)).toEqual([id(201), id(202)]);
    expect(ids((await get(b, { q: 'proposal' }).expect(200)).body)).toEqual([id(203)]);
    expect((await get(b, { q: 'prototype' }).expect(200)).body.total).toBe(0);
    expect((await get(a, { q: 'working prototype' }).expect(200)).body.total).toBe(0);
  });

  it('TEST-80 limits each supervisor to their assigned teams', async () => {
    const s1 = await supervisor1();
    const s2 = await supervisor2();
    expect(ids((await get(s1).expect(200)).body)).toEqual([201, 203, 204, 202].map(id));
    expect(ids((await get(s1, { q: 'proposal' }).expect(200)).body)).toEqual([201, 203].map(id));
    expect(ids((await get(s1, { q: 'proposal', teamId: id(102) }).expect(200)).body)).toEqual([id(203)]);
    expect(ids((await get(s2).expect(200)).body)).toEqual([id(205)]);
    expect((await get(s2, { q: 'proposal' }).expect(200)).body.total).toBe(1);
  });

  it('TEST-81 keeps counts and pages unchanged when a foreign team adds a match', async () => {
    const a = await studentA();
    const s2 = await supervisor2();
    const read = async () => Promise.all([
      get(a, { q: 'prototype', limit: 1 }).expect(200),
      get(a, { limit: 1, page: 2 }).expect(200),
      get(s2, { q: 'prototype' }).expect(200),
    ]).then(results => results.map(result => result.body));
    const before = await read();
    expect(before.map(body => body.total)).toEqual([1, 2, 0]);
    await prisma.milestone.create({ data: row(450, 'Prototype extra', new Date(0), 102) });
    expect(await read()).toEqual(before);
  });

  it('TEST-82 shares status semantics and sorts ties before slicing pages', async () => {
    const s1 = await supervisor1();
    await prisma.milestone.update({ where: { id: id(202) }, data: { closedAt: fx.clock.now() } });
    await prisma.milestone.createMany({ data: [row(453, 'Boundary second'), row(452, 'Boundary first')] });
    const order = [201, 203, 452, 453, 204, 202].map(id);
    const cases = [
      [{ status: 'OVERDUE' }, [203]],
      [{ status: 'REVIEWED' }, [201]],
      [{ status: 'SUBMITTED', q: 'requirements' }, [204]],
      [{ status: 'OVERDUE', q: 'proposal' }, [203]],
      [{ status: 'CLOSED' }, [202]],
      [{ status: 'NOT_SUBMITTED' }, [452, 453]],
    ] as const;
    for (const [query, expected] of cases) {
      const { body } = await get(s1, query).expect(200);
      expect(ids(body)).toEqual(expected.map(id));
      expect(body.total).toBe(expected.length);
    }
    expect(ids((await get(s1).expect(200)).body)).toEqual(order);
    const page = await get(s1, { limit: 2, page: 2 }).expect(200);
    expect(ids(page.body)).toEqual(order.slice(2, 4));
    expect(page.body.total).toBe(order.length);
    expect((await get(s1, { page: 99 }).expect(200)).body).toMatchObject({ items: [], total: 6 });

    const a = await studentA();
    await fx.as(a).post('/api/milestones/' + id(201) + '/revisions').send(validSubmission).expect(409);
    await prisma.milestone.update({
      where: { id: id(201) }, data: { dueAt: new Date(fx.clock.now().getTime() + 60_000) },
    });
    await fx.as(a).post('/api/milestones/' + id(201) + '/revisions').send(validSubmission).expect(201);
    expect(ids((await get(a, { q: 'proposal', status: 'SUBMITTED' }).expect(200)).body)).toEqual([id(201)]);
  });

  it('TEST-83 returns the same 404 for nonexistent and out-of-scope teams', async () => {
    const a = await studentA();
    const s1 = await supervisor1();
    const s2 = await supervisor2();
    const denied = await fx.as(a).get('/api/teams/' + id(102)).expect(404);
    for (const [cookie, team] of [[a, 102], [a, 999], [s2, 101], [s1, 103]] as const) {
      expect((await get(cookie, { teamId: id(team) }).expect(404)).text).toBe(denied.text);
    }
    expect(ids((await get(a, { teamId: id(101) }).expect(200)).body)).toEqual([201, 202].map(id));
    await get(a, { teamId: id(102), sort: 'title' }).expect(400);
  });

  it('TEST-84 rejects invalid boundaries and repeated, nested or unknown parameters', async () => {
    const a = await studentA();
    const inputs = ['limit=0', 'limit=51', 'limit=abc', 'page=0', 'page=abc', 'page=1.5',
      'page=9007199254740992', 'status=DONE', 'status=overdue', 'teamId=invalid', 'sort=title',
      'role=SUPERVISOR', 'q=a&q=b', 'q%5Bcontains%5D=x', 'q=%00', 'q=' + 'x'.repeat(101)];
    for (const input of inputs) {
      const response = await fx.as(a).get(path + '?' + input).expect(400);
      expect(response.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'The request is not valid.' } });
    }
    for (const limit of [1, 50]) await get(a, { limit, q: 'x'.repeat(100) }).expect(200);
  });

  it('TEST-85 searches for wildcard characters literally and returns an empty page for no match', async () => {
    const a = await studentA();
    await prisma.milestone.createMany({ data: [
      row(450, '100% done check'), row(451, 'Plan_B draft'),
      row(452, 'Plan B draft'), row(453, 'Owner\'s "final" review'), row(454, 'Path \\ sample'),
    ] });
    expect((await get(a, { q: 'zzzz' }).expect(200)).body).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    for (const [q, expected] of [['%', 450], ['_', 451], ["'", 453], ['"', 453], ['\\', 454]] as const) {
      expect(ids((await get(a, { q }).expect(200)).body)).toEqual([id(expected)]);
    }
  });

  it('TEST-86 checks the session before parameters and rejects revoked sessions', async () => {
    const a = await studentA();
    const expected = { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } };
    for (const url of [path, path + '?limit=999']) {
      expect((await fx.api.get(url).expect(401).expect('Cache-Control', 'no-store')).body).toEqual(expected);
    }
    await fx.as(a).post('/api/auth/logout').expect(200, { status: 'ok' });
    expect((await get(a).expect(401)).body).toEqual(expected);
  });

  it('TEST-96 bounds the status and paging window after scope and title filters', async () => {
    const a = await studentA();
    await prisma.milestone.createMany({ data: [
      row(7999, 'Window row', new Date(0), 102),
      ...Array.from({ length: 1001 }, (_, i) => ({
        ...row(8000 + i, 'Window row'), closedAt: i === 1000 ? fx.clock.now() : null,
      })),
    ] });
    const last = await get(a, { q: 'window', limit: 50, page: 20 }).expect(200);
    expect(last.body.total).toBe(1000);
    expect(ids(last.body)).toEqual(Array.from({ length: 50 }, (_, i) => id(8950 + i)));
    expect((await get(a, { q: 'window', limit: 50, page: 21 }).expect(200)).body).toMatchObject({ total: 1000, items: [] });
    expect((await get(a, { q: 'window', status: 'CLOSED' }).expect(200)).body).toMatchObject({ total: 0, items: [] });
  });
});
