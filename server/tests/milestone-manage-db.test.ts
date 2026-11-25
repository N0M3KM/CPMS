import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lockMilestone } from '../src/domain/closed.js';
import { createApiFixture, id, ORIGIN, SEED_NOW, validSubmission } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

const prisma = createTestPrisma();
// Seed: 201 Team A reviewed (submission 301), 202 Team A open "Prototype demo" (due +14 days, no submission),
// 203 Team B overdue (due -7 days, no submission), 204 Team B open with submission 302 (no feedback), 205 Team C.
const M = id(202);
const OVERDUE_B = id(203);
const SUBMITTED_B = id(204);
const DAY = 86_400_000;
const code = (res: { status: number; body: { error?: { code?: string } } }) => [res.status, res.body.error?.code];

// A fresh fixture (a fresh app and rate-limit window) per test: the fixed clock never ends a window.
let fx: ReturnType<typeof createApiFixture>;
let s1: string; let s2: string; let a1: string; let b1: string;

beforeEach(async () => {
  fx = createApiFixture(prisma);
  await fx.reset();
  // Sequential on purpose: the login throttle counts simultaneous attempts per IP (limit 5).
  s1 = await fx.login('supervisor1@example.test');
  s2 = await fx.login('supervisor2@example.test');
  a1 = await fx.login('student.a1@example.test');
  b1 = await fx.login('student.b1@example.test');
});
afterAll(() => prisma.$disconnect());

const stored = (milestoneId: string) => prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
const plus = (days: number) => new Date(SEED_NOW.getTime() + days * DAY);

describe('F-09 edit a milestone', () => {
  it('TEST-56 patches title and description, returns the stored values and keeps them after reload', async () => {
    const before = await stored(M);
    const res = await fx.as(s1).patch(`/api/milestones/${M}`)
      .send({ title: '  Prototype demo v2  ', description: 'Demo the working prototype to the supervisor.' }).expect(200);
    expect(res.body).toEqual({
      id: M, teamId: id(101), title: 'Prototype demo v2', description: 'Demo the working prototype to the supervisor.',
      dueAt: before.dueAt.toISOString(), closedAt: null,
    });
    const after = await stored(M);
    expect(after).toMatchObject({ title: 'Prototype demo v2', description: 'Demo the working prototype to the supervisor.' });
    expect(after.dueAt).toEqual(before.dueAt);
    expect(after.createdById).toBe(before.createdById);
    expect(after.createdAt).toEqual(before.createdAt);
    const reload = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(reload.body).toMatchObject({ title: 'Prototype demo v2', description: 'Demo the working prototype to the supervisor.', closedAt: null });
    // A description of 0 characters is allowed and a single field is enough.
    const cleared = await fx.as(s1).patch(`/api/milestones/${M}`).send({ description: '' }).expect(200);
    expect(cleared.body).toMatchObject({ title: 'Prototype demo v2', description: '' });
  });

  it('TEST-56 rejects a title or description outside the BR-03 limits and stores nothing', async () => {
    const before = await stored(M);
    for (const body of [{ title: 'abcd' }, { title: 'T'.repeat(101) }, { description: 'd'.repeat(1001) }, {}]) {
      expect(code(await fx.as(s1).patch(`/api/milestones/${M}`).send(body))).toEqual([400, 'VALIDATION_ERROR']);
    }
    expect(await stored(M)).toEqual(before);
  });

  it('TEST-57 rejects a past or equal dueAt, accepts a later and an earlier future dueAt, and recomputes the status', async () => {
    const before = await stored(M);
    for (const dueAt of [SEED_NOW, new Date(SEED_NOW.getTime() - 1), plus(-3)]) {
      expect(code(await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: dueAt.toISOString() }))).toEqual([400, 'VALIDATION_ERROR']);
    }
    expect((await stored(M)).dueAt).toEqual(before.dueAt);

    const later = await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: plus(30).toISOString() }).expect(200);
    expect(later.body.dueAt).toBe(plus(30).toISOString());
    const earlier = await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: plus(1).toISOString() }).expect(200);
    expect(earlier.body.dueAt).toBe(plus(1).toISOString());
    expect((await stored(M)).dueAt).toEqual(plus(1));
    expect((await fx.as(a1).get(`/api/milestones/${M}`).expect(200)).body.status).toBe('NOT_SUBMITTED');
    // The status is computed on read: once the new dueAt has passed the same milestone is overdue.
    fx.clock.advance(2 * DAY);
    const later2 = await fx.login('student.a1@example.test');   // the one hour session has ended
    expect((await fx.as(later2).get(`/api/milestones/${M}`).expect(200)).body.status).toBe('OVERDUE');
  });

  it('TEST-57 accepts a dueAt with an offset and stores the same instant', async () => {
    const res = await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: '2026-12-01T10:00:00+07:00' }).expect(200);
    expect(res.body.dueAt).toBe('2026-12-01T03:00:00.000Z');
    expect((await stored(M)).dueAt).toEqual(new Date('2026-12-01T03:00:00Z'));
  });

  it('TEST-58 answers 401, 403, uniform 404 and 400 for edit, and runs validation before the scope check', async () => {
    const before = await stored(M);
    const body = { title: 'Changed title here' };
    const none = await fx.api.patch(`/api/milestones/${M}`).set('Origin', ORIGIN).send(body);
    expect(code(none)).toEqual([401, 'UNAUTHENTICATED']);
    expect(code(await fx.as(a1).patch(`/api/milestones/${M}`).send(body))).toEqual([403, 'FORBIDDEN']);
    // The role check comes before body validation, so a student with a bad body still gets 403.
    expect(code(await fx.as(a1).patch(`/api/milestones/${M}`).send({ title: 'x' }))).toEqual([403, 'FORBIDDEN']);
    const otherTeam = await fx.as(s2).patch(`/api/milestones/${M}`).send(body);
    const missing = await fx.as(s1).patch(`/api/milestones/${id(999)}`).send(body);
    expect(code(otherTeam)).toEqual([404, 'NOT_FOUND']);
    expect(otherTeam.body).toEqual(missing.body);
    expect(missing.status).toBe(404);
    expect(code(await fx.as(s1).patch(`/api/milestones/${M}`).send({ title: 'Valid title', teamId: id(102) }))).toEqual([400, 'VALIDATION_ERROR']);
    expect(code(await fx.as(s1).patch(`/api/milestones/${M}`).send({ closedAt: SEED_NOW.toISOString() }))).toEqual([400, 'VALIDATION_ERROR']);
    expect(code(await fx.as(s1).patch('/api/milestones/not-a-uuid').send(body))).toEqual([400, 'VALIDATION_ERROR']);
    // Validation comes before the scope check, as in F-03: another team's supervisor with a bad body gets 400.
    expect(code(await fx.as(s2).patch(`/api/milestones/${M}`).send({ title: 'x' }))).toEqual([400, 'VALIDATION_ERROR']);
    expect(await stored(M)).toEqual(before);
  });
});

describe('F-09 close a milestone', () => {
  it('TEST-59 closing returns the stored closedAt and a second close returns ALREADY_CLOSED', async () => {
    const first = await fx.as(s1).post(`/api/milestones/${M}/close`).send({}).expect(200);
    expect(Object.keys(first.body).sort()).toEqual(['closedAt', 'id']);
    const row = await stored(M);
    expect(first.body.id).toBe(M);
    expect(first.body.closedAt).toBe(row.closedAt!.toISOString());
    expect(row.closedAt).toEqual(SEED_NOW);
    fx.clock.advance(60_000);
    const second = await fx.as(s1).post(`/api/milestones/${M}/close`).send({});
    expect(code(second)).toEqual([409, 'ALREADY_CLOSED']);
    expect((await stored(M)).closedAt).toEqual(SEED_NOW);
    const read = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(read.body).toMatchObject({ closedAt: SEED_NOW.toISOString(), status: 'CLOSED' });
  });

  it('TEST-58 answers 401, 403, uniform 404 and 400 for close, and accepts {} or an empty body only', async () => {
    const url = `/api/milestones/${M}/close`;
    expect(code(await fx.api.post(url).set('Origin', ORIGIN).send({}))).toEqual([401, 'UNAUTHENTICATED']);
    expect(code(await fx.as(a1).post(url).send({}))).toEqual([403, 'FORBIDDEN']);
    const otherTeam = await fx.as(s2).post(url).send({});
    const missing = await fx.as(s1).post(`/api/milestones/${id(999)}/close`).send({});
    expect(code(otherTeam)).toEqual([404, 'NOT_FOUND']);
    expect(otherTeam.body).toEqual(missing.body);
    expect(code(await fx.as(s1).post('/api/milestones/not-a-uuid/close').send({}))).toEqual([400, 'VALIDATION_ERROR']);
    expect(code(await fx.as(s1).post(url).send({ closedAt: SEED_NOW.toISOString() }))).toEqual([400, 'VALIDATION_ERROR']);
    expect(code(await fx.as(s1).post(url).send({ title: 'Another title' }))).toEqual([400, 'VALIDATION_ERROR']);
    expect((await stored(M)).closedAt).toBeNull();
    await fx.as(s1).post(url).send({}).expect(200);
    await fx.as(s1).post(`/api/milestones/${OVERDUE_B}/close`).expect(200);   // no body at all
    expect((await stored(OVERDUE_B)).closedAt).toEqual(SEED_NOW);
  });

  it('TEST-60 a closed milestone rejects edit and first submission with MILESTONE_CLOSED and changes nothing', async () => {
    await fx.as(s1).post(`/api/milestones/${M}/close`).send({}).expect(200);
    const before = await stored(M);
    const edit = await fx.as(s1).patch(`/api/milestones/${M}`).send({ title: 'New title here' });
    expect(code(edit)).toEqual([409, 'MILESTONE_CLOSED']);
    const submit = await fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission);
    expect(code(submit)).toEqual([409, 'MILESTONE_CLOSED']);
    expect(await stored(M)).toEqual(before);
    expect(await prisma.submission.count({ where: { milestoneId: M } })).toBe(0);
    // Validation comes before the closed check: a past dueAt on a closed milestone reports 400.
    const past = await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: plus(-1).toISOString() });
    expect(code(past)).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('TEST-60 checks a submission in the order 404, closed, duplicate, deadline', async () => {
    const closeTwo = async () => {
      await fx.as(s1).post(`/api/milestones/${SUBMITTED_B}/close`).send({}).expect(200);
      await fx.as(s1).post(`/api/milestones/${OVERDUE_B}/close`).send({}).expect(200);
    };
    // Open milestones keep the Sprint 1 order: duplicate, then deadline.
    expect(code(await fx.as(b1).post(`/api/milestones/${SUBMITTED_B}/submission`).send(validSubmission))).toEqual([409, 'DUPLICATE_SUBMISSION']);
    expect(code(await fx.as(b1).post(`/api/milestones/${OVERDUE_B}/submission`).send(validSubmission))).toEqual([409, 'DEADLINE_PASSED']);
    await closeTwo();
    // Closed and submitted reports MILESTONE_CLOSED, and so does closed and overdue.
    expect(code(await fx.as(b1).post(`/api/milestones/${SUBMITTED_B}/submission`).send(validSubmission))).toEqual([409, 'MILESTONE_CLOSED']);
    expect(code(await fx.as(b1).post(`/api/milestones/${OVERDUE_B}/submission`).send(validSubmission))).toEqual([409, 'MILESTONE_CLOSED']);
    // Not your milestone is still the uniform 404, even when it is closed.
    expect(code(await fx.as(a1).post(`/api/milestones/${OVERDUE_B}/submission`).send(validSubmission))).toEqual([404, 'NOT_FOUND']);
    expect(await prisma.submission.count({ where: { milestoneId: OVERDUE_B } })).toBe(0);
    expect(await prisma.submission.count({ where: { milestoneId: SUBMITTED_B } })).toBe(1);
  });

  it('TEST-61 submissions, feedback and reads stay available after the milestone is closed', async () => {
    const REVIEWED_A = id(201);
    await prisma.grade.create({ data: { submissionId: id(301), supervisorId: id(1), score: 88 } });
    await fx.as(s1).post(`/api/milestones/${REVIEWED_A}/close`).send({}).expect(200);
    await fx.as(s1).post(`/api/milestones/${M}/close`).send({}).expect(200);
    for (const cookie of [a1, s1]) {
      const res = await fx.as(cookie).get(`/api/milestones/${REVIEWED_A}`).expect(200);
      expect(res.body).toMatchObject({
        status: 'REVIEWED', closedAt: SEED_NOW.toISOString(),
        submission: { id: id(301), feedback: { comment: expect.any(String) } },
      });
    }
    // Closed with work keeps REVIEWED, closed without work is CLOSED, and a closed milestone is never next due.
    const team = await fx.as(a1).get(`/api/teams/${id(101)}`).expect(200);
    expect(team.body.milestones.map((m: { id: string; status: string }) => [m.id, m.status])).toEqual([[REVIEWED_A, 'REVIEWED'], [M, 'CLOSED']]);
    const list = await fx.as(s1).get('/api/teams').expect(200);
    expect(list.body.teams[0]).toMatchObject({
      id: id(101), progress: { notSubmitted: 0, reviewed: 1, closed: 1 }, nextDue: null,
    });
    expect(await prisma.grade.count({ where: { submissionId: id(301) } })).toBe(1);
  });

  it('TEST-63 extending an overdue milestone with no submission makes it NOT_SUBMITTED and accepts a submission', async () => {
    expect((await fx.as(b1).get(`/api/milestones/${OVERDUE_B}`).expect(200)).body.status).toBe('OVERDUE');
    expect(code(await fx.as(b1).post(`/api/milestones/${OVERDUE_B}/submission`).send(validSubmission))).toEqual([409, 'DEADLINE_PASSED']);
    await fx.as(s1).patch(`/api/milestones/${OVERDUE_B}`).send({ dueAt: plus(5).toISOString() }).expect(200);
    expect((await fx.as(b1).get(`/api/milestones/${OVERDUE_B}`).expect(200)).body.status).toBe('NOT_SUBMITTED');
    await fx.as(b1).post(`/api/milestones/${OVERDUE_B}/submission`).send(validSubmission).expect(201);
    expect((await fx.as(b1).get(`/api/milestones/${OVERDUE_B}`).expect(200)).body.status).toBe('SUBMITTED');
  });

  it('TEST-63 changing the dueAt of a milestone that already has a submission keeps its status', async () => {
    await fx.as(s1).patch(`/api/milestones/${SUBMITTED_B}`).send({ dueAt: plus(40).toISOString() }).expect(200);
    expect((await fx.as(b1).get(`/api/milestones/${SUBMITTED_B}`).expect(200)).body.status).toBe('SUBMITTED');
  });

  it('TEST-88 feedback is still accepted on a closed milestone (feedback part; the grade part is added at integration)', async () => {
    await fx.as(s1).post(`/api/milestones/${SUBMITTED_B}/close`).send({}).expect(200);
    const res = await fx.as(s1).post(`/api/submissions/${id(302)}/feedback`)
      .send({ comment: 'Clear structure. Please add measurable goals.' });
    expect(res.status).toBe(201);
    const read = await fx.as(b1).get(`/api/milestones/${SUBMITTED_B}`).expect(200);
    expect(read.body).toMatchObject({ status: 'REVIEWED', closedAt: SEED_NOW.toISOString() });
  });
});

describe('F-09 close against a first submission (BR-09, row lock)', () => {
  const poll = async (done: () => Promise<boolean>, timeoutMs: number) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end && !(await done())) await new Promise(r => setTimeout(r, 25));
  };

  it('TEST-89a a submission waiting on the row lock while a close commits gets MILESTONE_CLOSED and stores nothing', async () => {
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>(r => { release = r; });
    const lockTaken = new Promise<void>(r => { locked = r; });
    const closer = prisma.$transaction(async (tx) => {
      await lockMilestone(tx, M);
      await tx.milestone.update({ where: { id: M }, data: { closedAt: fx.clock.now() } });
      locked();
      await held;                                   // keep the lock until the submission is waiting on it
    });
    await lockTaken;
    const submission = fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission).then(res => res);   // .then sends it
    // Wait until a backend is blocked on a lock (the submission), then let the close commit.
    await poll(async () => {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`;
      return (rows[0]?.n ?? 0n) > 0n;
    }, 3000);
    release();
    await closer;
    const res = await submission;
    expect(code(res)).toEqual([409, 'MILESTONE_CLOSED']);
    expect(await prisma.submission.count({ where: { milestoneId: M } })).toBe(0);
    expect((await stored(M)).closedAt).toEqual(SEED_NOW);
  });

  it('TEST-89b close and first submission started together always end as 201 then close, or close then 409 with no row (10 runs)', async () => {
    const outcomes: string[] = [];
    for (let run = 0; run < 10; run++) {
      await prisma.submission.deleteMany({ where: { milestoneId: M } });
      await prisma.milestone.update({ where: { id: M }, data: { closedAt: null } });
      const close = () => fx.as(s1).post(`/api/milestones/${M}/close`).send({}).then(res => res);
      const submit = () => fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission).then(res => res);
      // Alternate which request is sent first so both orders of arrival are exercised.
      const [closeRes, submitRes] = run % 2 === 0
        ? await Promise.all([close(), submit()])
        : (await Promise.all([submit(), close()])).reverse() as [Awaited<ReturnType<typeof close>>, Awaited<ReturnType<typeof submit>>];
      const rows = await prisma.submission.count({ where: { milestoneId: M } });
      expect(closeRes.status, `run ${run} close`).toBe(200);
      expect((await stored(M)).closedAt, `run ${run} closedAt`).toEqual(SEED_NOW);
      if (submitRes.status === 201) {
        expect(rows, `run ${run} stored row`).toBe(1);
        outcomes.push('submission then close');
      } else {
        expect([submitRes.status, submitRes.body.error?.code], `run ${run} submission`).toEqual([409, 'MILESTONE_CLOSED']);
        expect(rows, `run ${run} stored row`).toBe(0);
        outcomes.push('close then 409');
      }
    }
    expect(outcomes).toHaveLength(10);
  });
});
