import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

const prisma = createTestPrisma();
// The app's request limiter (100 requests a minute per IP) keeps its count across tests because the fixture clock is
// reset to the same instant, so a fresh app is built for every test.
let fx = createApiFixture(prisma);

// Seed: submission 301 is revision 1 of milestone 201 (Team A) and already has feedback; 302 is revision 1 of
// milestone 204 (Team B) with no feedback. Supervisor S1 supervises Teams A and B; S2 supervises Team C only.
const REVIEWED_A = id(301);
const OPEN_B = id(302);
const MILESTONE_A = id(201);
const MILESTONE_B = id(204);
const S1_ID = id(1);
const REV2_A = id(311);
const REV2_B = id(312);

const gradePath = (submissionId: string) => `/api/submissions/${submissionId}/grade`;
const gradeCount = () => prisma.grade.count();
const errorOf = (res: { status: number; body: { error?: { code?: string } } }) => [res.status, res.body.error?.code];

let s1: string; let s2: string; let a1: string; let b1: string;

// A second revision is created directly with Prisma here; the revisions route is covered in revisions-db.test.ts.
async function addRevision2(submissionId: string, milestoneId: string, withFeedback: boolean) {
  await prisma.submission.create({
    data: {
      id: submissionId, milestoneId, revisionNo: 2, title: 'Second version',
      description: 'Revised work for the same milestone.', link: 'https://example.test/v2',
      submittedById: id(11), submittedAt: fx.clock.now(),
    },
  });
  if (withFeedback) {
    await prisma.feedback.create({
      data: { submissionId, supervisorId: S1_ID, comment: 'Second version reviewed and accepted.' },
    });
  }
}

describe('F-10 grades (API + database)', () => {
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

  it('TEST-65 the team supervisor grades the current revision; supervisor comes from the session, revision from the path', async () => {
    const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ score: 90, supervisor: { id: S1_ID, name: 'Supervisor One' } });
    const rows = await prisma.grade.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ submissionId: REVIEWED_A, supervisorId: S1_ID, score: 90 });
  });

  it('TEST-65 a supervisor id or submission id in the body is refused and nothing is stored', async () => {
    const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90, supervisorId: id(2), submissionId: OPEN_B });
    expect(errorOf(res)).toEqual([400, 'VALIDATION_ERROR']);
    expect(await gradeCount()).toBe(0);
  });

  it('TEST-65 a closed milestone still accepts a grade (no closedAt check, SRS D-18)', async () => {
    await prisma.milestone.update({ where: { id: MILESTONE_A }, data: { closedAt: fx.clock.now() } });
    await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 77 }).expect(201);
    expect(await gradeCount()).toBe(1);
  });

  it('TEST-66 a revision with no feedback returns FEEDBACK_REQUIRED and stores nothing', async () => {
    const res = await fx.as(s1).post(gradePath(OPEN_B)).send({ score: 80 });
    expect(errorOf(res)).toEqual([409, 'FEEDBACK_REQUIRED']);
    expect(await gradeCount()).toBe(0);
  });

  it('TEST-67 a second grade on the same revision returns GRADE_EXISTS and keeps the first value', async () => {
    await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 }).expect(201);
    const second = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 40 });
    expect(errorOf(second)).toEqual([409, 'GRADE_EXISTS']);
    const rows = await prisma.grade.findMany({ where: { submissionId: REVIEWED_A } });
    expect(rows.map((r) => r.score)).toEqual([90]);
  });

  it('TEST-67 two simultaneous grades on the same revision give one 201, one 409 GRADE_EXISTS and one row', async () => {
    // Both sessions are signed in before the requests are sent (login throttle).
    const [x, y] = await Promise.all([
      fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 }),
      fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 40 }),
    ]);
    expect([x.status, y.status].sort()).toEqual([201, 409]);
    const loser = x.status === 409 ? x : y;
    expect(errorOf(loser)).toEqual([409, 'GRADE_EXISTS']);
    const rows = await prisma.grade.findMany({ where: { submissionId: REVIEWED_A } });
    expect(rows).toHaveLength(1);
    const winner = x.status === 201 ? x : y;
    expect(rows[0]?.score).toBe(winner.body.score);
  });

  describe('TEST-68 score rule at the API', () => {
    it.each([
      ['101', 101], ['-1', -1], ['85.5', 85.5], ['the string "90"', '90'], ['null', null],
    ])('rejects score %s with 400 and stores nothing', async (_label, score) => {
      const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score });
      expect(errorOf(res)).toEqual([400, 'VALIDATION_ERROR']);
      expect(await gradeCount()).toBe(0);
    });

    it('rejects a missing score and an unknown field with 400', async () => {
      expect((await fx.as(s1).post(gradePath(REVIEWED_A)).send({})).status).toBe(400);
      expect((await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90, comment: 'x' })).status).toBe(400);
      expect(await gradeCount()).toBe(0);
    });

    it('accepts 0 and 100 (on separate revisions)', async () => {
      await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 0 }).expect(201);
      await addRevision2(REV2_A, MILESTONE_A, true);
      await fx.as(s1).post(gradePath(REV2_A)).send({ score: 100 }).expect(201);
      const rows = await prisma.grade.findMany({ orderBy: { score: 'asc' } });
      expect(rows.map((r) => r.score)).toEqual([0, 100]);
    });

    it('validates before the scope lookup: a bad body on an unknown submission is 400, a good one is 404', async () => {
      expect((await fx.as(s1).post(gradePath(id(999))).send({ score: 101 })).status).toBe(400);
      expect((await fx.as(s1).post(gradePath(id(999))).send({ score: 90 })).status).toBe(404);
      expect((await fx.as(s1).post(gradePath('not-a-uuid')).send({ score: 90 })).status).toBe(400);
    });
  });

  it('TEST-70 a student gets 403, another team supervisor gets the uniform 404, no session gets 401', async () => {
    const student = await fx.as(a1).post(gradePath(REVIEWED_A)).send({ score: 90 });
    expect(errorOf(student)).toEqual([403, 'FORBIDDEN']);

    const foreign = await fx.as(s2).post(gradePath(REVIEWED_A)).send({ score: 90 });
    const missing = await fx.as(s2).post(gradePath(id(999))).send({ score: 90 });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);

    const anonymous = await fx.api.post(gradePath(REVIEWED_A)).set('Origin', 'http://localhost:5173').send({ score: 90 });
    expect(errorOf(anonymous)).toEqual([401, 'UNAUTHENTICATED']);

    expect(await gradeCount()).toBe(0);
  });

  it('TEST-71 an earlier revision keeps its grade and the new revision has none until it is graded', async () => {
    await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 }).expect(201);
    await addRevision2(REV2_A, MILESTONE_A, false);

    expect((await prisma.grade.findUnique({ where: { submissionId: REVIEWED_A } }))?.score).toBe(90);
    expect(await prisma.grade.findUnique({ where: { submissionId: REV2_A } })).toBeNull();

    // The new revision is graded on its own feedback, and the first grade is unchanged.
    expect(errorOf(await fx.as(s1).post(gradePath(REV2_A)).send({ score: 60 }))).toEqual([409, 'FEEDBACK_REQUIRED']);
    await prisma.feedback.create({ data: { submissionId: REV2_A, supervisorId: S1_ID, comment: 'Better, please polish the report.' } });
    await fx.as(s1).post(gradePath(REV2_A)).send({ score: 60 }).expect(201);
    expect((await prisma.grade.findUnique({ where: { submissionId: REVIEWED_A } }))?.score).toBe(90);
    expect((await prisma.grade.findUnique({ where: { submissionId: REV2_A } }))?.score).toBe(60);
  });

  it('TEST-72 the grade response has exactly score, createdAt and supervisor {id, name}', async () => {
    const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 88 }).expect(201);
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'score', 'supervisor']);
    expect(Object.keys(res.body.supervisor).sort()).toEqual(['id', 'name']);
    expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
  });

  describe('TEST-87 only the current revision can be graded', () => {
    it('grading a superseded revision returns REVISION_SUPERSEDED and stores nothing', async () => {
      await addRevision2(REV2_A, MILESTONE_A, false);
      const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 });
      expect(errorOf(res)).toEqual([409, 'REVISION_SUPERSEDED']);
      expect(await gradeCount()).toBe(0);
    });

    it('a superseded revision that already has a grade reports REVISION_SUPERSEDED, not GRADE_EXISTS', async () => {
      await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 }).expect(201);
      await addRevision2(REV2_A, MILESTONE_A, false);
      const res = await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 50 });
      expect(errorOf(res)).toEqual([409, 'REVISION_SUPERSEDED']);
      expect((await prisma.grade.findUnique({ where: { submissionId: REVIEWED_A } }))?.score).toBe(90);
    });

    it('a superseded revision without feedback reports REVISION_SUPERSEDED, not FEEDBACK_REQUIRED', async () => {
      await addRevision2(REV2_B, MILESTONE_B, false);
      const res = await fx.as(s1).post(gradePath(OPEN_B)).send({ score: 70 });
      expect(errorOf(res)).toEqual([409, 'REVISION_SUPERSEDED']);
      expect(await gradeCount()).toBe(0);
    });
  });

  it('keeps the grade out of the team detail and out of the Sprint 1 submission keys', async () => {
    await fx.as(s1).post(gradePath(REVIEWED_A)).send({ score: 90 }).expect(201);
    // The grade is read through revisions[] only (F-08, see grades-visibility.test.ts).
    expect((await fx.as(b1).get(`/api/teams/${id(101)}`)).status).toBe(404);
    const team = await fx.as(a1).get(`/api/teams/${id(101)}`).expect(200);
    expect(JSON.stringify(team.body)).not.toContain('"score"');
    const detail = await fx.as(a1).get(`/api/milestones/${MILESTONE_A}`).expect(200);
    expect(detail.body.submission).not.toHaveProperty('grade');
  });
});
