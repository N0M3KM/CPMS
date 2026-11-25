import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id, SEED_NOW, validSubmission } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

// Cross-feature checks (Sprint 2 STS TEST-88 grade part and TEST-91 to TEST-95): revisions (F-08), milestone
// management (F-09) and grades (F-10) acting on the same milestone. Milestone 202 (Team A, open, no submission) is
// the working row; Team B (B1) and Supervisor S2 (Team C) are the outsiders.
const prisma = createTestPrisma();
const fx = createApiFixture(prisma);
const M = id(202);
const DAY = 86_400_000;
let s1: string; let s2: string; let a1: string; let b1: string;

beforeEach(async () => {
  await fx.reset();
  s1 = await fx.login('supervisor1@example.test');
  s2 = await fx.login('supervisor2@example.test');
  a1 = await fx.login('student.a1@example.test');
  b1 = await fx.login('student.b1@example.test');
});
afterAll(() => prisma.$disconnect());

const status = async (cookie: string, milestoneId = M) => (await fx.as(cookie).get(`/api/milestones/${milestoneId}`).expect(200)).body.status as string;
const submitFirst = () => fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission);
const revise = (title = 'Prototype demo v2') => fx.as(a1).post(`/api/milestones/${M}/revisions`).send({ ...validSubmission, title });
const feedback = (submissionId: string) => fx.as(s1).post(`/api/submissions/${submissionId}/feedback`).send({ comment: 'Good start, add detail.' });
const grade = (submissionId: string, score = 80) => fx.as(s1).post(`/api/submissions/${submissionId}/grade`).send({ score });
const revisionId = async (revisionNo: number) =>
  (await prisma.submission.findFirstOrThrow({ where: { milestoneId: M, revisionNo } })).id;
const code = (res: { status: number; body: { error?: { code?: string } } }) => [res.status, res.body.error?.code];

describe('Sprint 2 cross-feature checks', () => {
  it('TEST-91 revision, feedback, revision again: status goes SUBMITTED, REVIEWED, SUBMITTED', async () => {
    await submitFirst().expect(201);
    expect(await status(a1)).toBe('SUBMITTED');
    await feedback(await revisionId(1)).expect(201);
    expect(await status(a1)).toBe('REVIEWED');
    await revise().expect(201);
    expect(await status(a1)).toBe('SUBMITTED');
    const detail = (await fx.as(a1).get(`/api/milestones/${M}`).expect(200)).body;
    expect(detail.revisions.map((r: { revisionNo: number; feedback: unknown }) => [r.revisionNo, r.feedback !== null])).toEqual([[1, true], [2, false]]);
  });

  it('TEST-92 extending a deadline reopens submission; a past deadline is rejected and changes nothing', async () => {
    await prisma.milestone.update({ where: { id: M }, data: { dueAt: new Date(SEED_NOW.getTime() - 3_600_000) } });
    expect(code(await submitFirst())).toEqual([409, 'DEADLINE_PASSED']);
    expect(await status(a1)).toBe('OVERDUE');
    const past = await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: new Date(SEED_NOW.getTime() - 60_000).toISOString() });
    expect(past.status).toBe(400);
    await fx.as(s1).patch(`/api/milestones/${M}`).send({ dueAt: new Date(SEED_NOW.getTime() + DAY).toISOString() }).expect(200);
    expect(await status(a1)).toBe('NOT_SUBMITTED');
    await submitFirst().expect(201);
  });

  it('TEST-93 after close a revision is refused, while feedback and a grade are still accepted', async () => {
    await submitFirst().expect(201);
    const rev1 = await revisionId(1);
    await fx.as(s1).post(`/api/milestones/${M}/close`).send({}).expect(200);
    expect(code(await revise())).toEqual([409, 'MILESTONE_CLOSED']);
    await feedback(rev1).expect(201);
    await grade(rev1, 85).expect(201);                       // TEST-88, grade part
    const detail = (await fx.as(a1).get(`/api/milestones/${M}`).expect(200)).body;
    expect(detail).toMatchObject({ status: 'REVIEWED' });
    expect(detail.closedAt).not.toBeNull();
    expect(detail.revisions.at(-1).grade.score).toBe(85);
  });

  it('TEST-94 a closed milestone with no submission counts only in progress.closed; other teams are unchanged', async () => {
    const before = (await fx.as(s1).get('/api/teams').expect(200)).body.teams;
    await fx.as(s1).post(`/api/milestones/${M}/close`).send({}).expect(200);
    expect(await status(a1)).toBe('CLOSED');
    const after = (await fx.as(s1).get('/api/teams').expect(200)).body.teams;
    type TeamRow = { id: string; progress: Record<string, number>; nextDue: unknown };
    const byId = (teams: TeamRow[], teamId: string): TeamRow => {
      const team = teams.find(t => t.id === teamId);
      if (!team) throw new Error(`team ${teamId} missing`);
      return team;
    };
    const a = byId(after, id(101)); const aBefore = byId(before, id(101));
    expect(a.progress.closed).toBe(1);
    expect(a.progress.notSubmitted).toBe((aBefore.progress.notSubmitted ?? 0) - 1);
    expect(a.progress.reviewed).toBe(aBefore.progress.reviewed);
    expect(a.nextDue).toBeNull();                              // a closed milestone is never next due
    expect(byId(after, id(102))).toEqual(byId(before, id(102)));
  });

  it('TEST-95 another team and another supervisor get the uniform 404 on revisions, close, edit and grade', async () => {
    await submitFirst().expect(201);
    const rev1 = await revisionId(1);
    await feedback(rev1).expect(201);
    const notFound = (await fx.as(b1).get(`/api/milestones/${id(999)}`)).body;      // the uniform 404 body
    const results = [
      await fx.as(b1).post(`/api/milestones/${M}/revisions`).send(validSubmission),   // student of another team
      await fx.as(s2).post(`/api/milestones/${M}/close`).send({}),                    // supervisor of another team
      await fx.as(s2).patch(`/api/milestones/${M}`).send({ title: 'Hijacked title' }),
      await fx.as(s2).post(`/api/submissions/${rev1}/grade`).send({ score: 50 }),
    ];
    for (const res of results) expect([res.status, res.body]).toEqual([404, notFound]);
    // Role first: a student on a supervisor route and a supervisor on a student route get 403, not 404.
    expect((await fx.as(b1).post(`/api/milestones/${M}/close`).send({})).status).toBe(403);
    expect((await fx.as(s2).post(`/api/milestones/${M}/revisions`).send(validSubmission)).status).toBe(403);
    expect(await prisma.grade.count()).toBe(0);
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: M } })).closedAt).toBeNull();
  });
});
