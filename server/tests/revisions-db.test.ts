import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id, validSubmission } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

const prisma = createTestPrisma();
// A fresh app per test gives each test its own rate-limit window (100 requests a minute on the fixed clock).
let fx = createApiFixture(prisma);
// Seed: milestone 202 "Prototype demo" belongs to Team A, is open (due 2026-11-22T12:00Z) and has no submission.
const M = id(202);
const DUE = new Date('2026-11-22T12:00:00Z');
const SIX_KEYS = ['description', 'feedback', 'id', 'link', 'submittedAt', 'title'];
const comment = 'Please add measurable goals.';

let a1: string; let a2: string; let s1: string; let b1: string;

beforeEach(async () => {
  fx = createApiFixture(prisma);
  await fx.reset();
  // Sequential on purpose: the login throttle counts simultaneous attempts per IP (limit 5).
  a1 = await fx.login('student.a1@example.test');
  a2 = await fx.login('student.a2@example.test');
  s1 = await fx.login('supervisor1@example.test');
  b1 = await fx.login('student.b1@example.test');
  // Precondition: a wrong assumption about the seed must fail loudly here.
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: M }, select: { teamId: true, dueAt: true, closedAt: true } });
  expect(milestone).toEqual({ teamId: id(101), dueAt: DUE, closedAt: null });
  expect(await prisma.submission.count({ where: { milestoneId: M } })).toBe(0);
});
afterAll(() => prisma.$disconnect());

const submitFirst = () => fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission).expect(201);
const revise = (cookie: string, body: object = validSubmission) => fx.as(cookie).post(`/api/milestones/${M}/revisions`).send(body);
const rows = () => prisma.submission.findMany({ where: { milestoneId: M }, orderBy: { revisionNo: 'asc' } });
const revisionOf = async (revisionNo: number) =>
  (await prisma.submission.findFirstOrThrow({ where: { milestoneId: M, revisionNo } })).id;

describe('F-08 revisions', () => {
  it('TEST-44 creates revision 2 and leaves revision 1 unchanged', async () => {
    await submitFirst();
    const before = (await rows())[0]!;
    const res = await revise(a1, { ...validSubmission, title: 'Prototype demo v2' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String), milestoneId: M, revisionNo: 2, title: 'Prototype demo v2',
      description: validSubmission.description, link: validSubmission.link,
      submittedBy: { id: id(11), name: 'Student A1' }, submittedAt: fx.clock.now().toISOString(), feedback: null, grade: null,
    });
    const after = await rows();
    expect(after.map((r) => r.revisionNo)).toEqual([1, 2]);
    expect(after[0]).toEqual(before);
    expect(after[0]!.title).toBe(validSubmission.title);
  });

  it('TEST-44 lets any team member revise and records the session student', async () => {
    await submitFirst();
    const res = await revise(a2).expect(201);
    expect(res.body.submittedBy).toEqual({ id: id(12), name: 'Student A2' });
    expect((await rows())[1]).toMatchObject({ revisionNo: 2, submittedById: id(12) });
  });

  it('TEST-45 rejects a revision when there is no first submission', async () => {
    const res = await revise(a1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SUBMISSION');
    expect(await rows()).toEqual([]);
  });

  it('TEST-46 accepts a revision before and at dueAt, and rejects one after it', async () => {
    await submitFirst();
    // Move the injectable clock, then sign in again (the fixture session lasts one hour).
    fx.clock.advance(DUE.getTime() - 1 - fx.clock.now().getTime());
    a1 = await fx.login('student.a1@example.test');
    expect((await revise(a1)).status).toBe(201);
    fx.clock.advance(1);
    expect(fx.clock.now()).toEqual(DUE);
    a1 = await fx.login('student.a1@example.test');
    expect((await revise(a1)).status).toBe(201);
    fx.clock.advance(1);
    a1 = await fx.login('student.a1@example.test');
    const late = await revise(a1);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('DEADLINE_PASSED');
    expect((await rows()).map((r) => r.revisionNo)).toEqual([1, 2, 3]);
  });

  it('TEST-47 rejects a revision on a closed milestone, ahead of the deadline check', async () => {
    await submitFirst();
    await prisma.milestone.update({ where: { id: M }, data: { closedAt: fx.clock.now() } });
    const res = await revise(a1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MILESTONE_CLOSED');
    expect(await rows()).toHaveLength(1);

    // Closed and past due: MILESTONE_CLOSED still comes first.
    fx.clock.advance(DUE.getTime() + 1 - fx.clock.now().getTime());
    a1 = await fx.login('student.a1@example.test');
    expect((await revise(a1)).body.error.code).toBe('MILESTONE_CLOSED');
    expect(await rows()).toHaveLength(1);
  });

  it('TEST-48 accepts version 5 and rejects version 6 with REVISION_LIMIT', async () => {
    await submitFirst();
    expect((await revise(a1).expect(201)).body.revisionNo).toBe(2);
    expect((await revise(a1).expect(201)).body.revisionNo).toBe(3);
    await prisma.submission.create({
      data: { milestoneId: M, revisionNo: 4, title: validSubmission.title, description: validSubmission.description,
        link: validSubmission.link, submittedById: id(11), submittedAt: fx.clock.now() },
    });
    const fifth = await revise(a1);
    expect(fifth.status).toBe(201);
    expect(fifth.body.revisionNo).toBe(5);
    const sixth = await revise(a1);
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe('REVISION_LIMIT');
    expect((await rows()).map((r) => r.revisionNo)).toEqual([1, 2, 3, 4, 5]);
  });

  it('TEST-48 the database itself rejects revisionNo 6, 0 and a duplicate revisionNo', async () => {
    await submitFirst();
    const base = {
      milestoneId: M, title: validSubmission.title, description: validSubmission.description,
      link: validSubmission.link, submittedById: id(11), submittedAt: fx.clock.now(),
    };
    await expect(prisma.submission.create({ data: { ...base, revisionNo: 6 } })).rejects.toThrow();
    await expect(prisma.submission.create({ data: { ...base, revisionNo: 0 } })).rejects.toThrow();
    await expect(prisma.submission.create({ data: { ...base, revisionNo: 1 } })).rejects.toThrow();
    expect(await rows()).toHaveLength(1);
  });

  it('TEST-49 two concurrent revisions both succeed as 2 and 3', async () => {
    await submitFirst();
    // Both members signed in above; only the revisions run at the same time.
    const [x, y] = await Promise.all([revise(a1), revise(a2)]);
    expect([x.status, y.status]).toEqual([201, 201]);
    expect([x.body.revisionNo, y.body.revisionNo].sort()).toEqual([2, 3]);
    expect((await rows()).map((r) => r.revisionNo)).toEqual([1, 2, 3]);
  });

  it('TEST-50 rejects invalid fields and unknown fields without storing anything', async () => {
    await submitFirst();
    const bad: object[] = [
      { ...validSubmission, title: 'abcd' },
      { ...validSubmission, description: 'd'.repeat(19) },
      { ...validSubmission, link: 'javascript:alert(1)' },
      { ...validSubmission, revisionNo: 9 },
      { ...validSubmission, submittedById: id(12) },
      { ...validSubmission, milestoneId: id(205) },
      { ...validSubmission, submittedAt: '2020-01-01T00:00:00Z' },
      { title: validSubmission.title, description: validSubmission.description },
    ];
    for (const body of bad) {
      const res = await revise(a1, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    await fx.as(a1).post('/api/milestones/not-a-uuid/revisions').send(validSubmission).expect(400);
    expect(await rows()).toHaveLength(1);
  });

  it('TEST-51 answers 401 without a session, 403 to a supervisor and the uniform 404 to another team', async () => {
    await submitFirst();
    expect((await revise('')).status).toBe(401);
    const supervisor = await revise(s1);
    expect(supervisor.status).toBe(403);
    expect(supervisor.body.error.code).toBe('FORBIDDEN');
    const foreign = await revise(b1);
    const missing = await fx.as(b1).post(`/api/milestones/${id(999)}/revisions`).send(validSubmission);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    // Validation comes before the scope check, so an invalid body from another team is still a 400.
    expect((await revise(b1, { title: 'abc' })).status).toBe(400);
    expect(await rows()).toHaveLength(1);
  });

  it('TEST-52 keeps the six Sprint 1 submission keys and adds revisions[] in ascending order', async () => {
    await submitFirst();
    await revise(a1, { ...validSubmission, title: 'Prototype demo v2' }).expect(201);
    const res = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(res.body.closedAt).toBeNull();
    expect(Object.keys(res.body.submission).sort()).toEqual(SIX_KEYS);
    expect(res.body.submission).toMatchObject({ title: 'Prototype demo v2', feedback: null });
    expect(res.body.revisions.map((r: { revisionNo: number }) => r.revisionNo)).toEqual([1, 2]);
    for (const item of res.body.revisions) {
      expect(Object.keys(item).sort()).toEqual(['description', 'feedback', 'grade', 'id', 'link', 'revisionNo', 'submittedAt', 'title']);
      expect(item.grade).toBeNull();
    }
    expect(res.body.revisions[1]).toMatchObject({ id: res.body.submission.id, title: 'Prototype demo v2' });
    const other = await fx.as(b1).get(`/api/milestones/${M}`).expect(404);
    expect(other.body).toEqual((await fx.as(b1).get(`/api/milestones/${id(999)}`).expect(404)).body);
    expect(other.body.revisions).toBeUndefined();
  });

  it('TEST-52 returns an empty revisions list when there is no submission', async () => {
    const res = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(res.body.submission).toBeNull();
    expect(res.body.revisions).toEqual([]);
  });

  it('TEST-52 includes a grade with its supervisor when one exists', async () => {
    await submitFirst();
    await prisma.grade.create({ data: { submissionId: await revisionOf(1), supervisorId: id(1), score: 80 } });
    const res = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(res.body.revisions[0].grade).toEqual({ score: 80, createdAt: expect.any(String), supervisor: { id: id(1), name: 'Supervisor One' } });
  });

  it('TEST-53 shows SUBMITTED after a revision and keeps the first feedback on revision 1', async () => {
    await submitFirst();
    const first = await revisionOf(1);
    await fx.as(s1).post(`/api/submissions/${first}/feedback`).send({ comment }).expect(201);
    expect((await fx.as(a1).get(`/api/milestones/${M}`)).body.status).toBe('REVIEWED');

    await revise(a1).expect(201);
    const res = await fx.as(a1).get(`/api/milestones/${M}`).expect(200);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.submission.feedback).toBeNull();
    expect(res.body.revisions[0].feedback).toMatchObject({ comment });
    expect(res.body.revisions[1].feedback).toBeNull();

    // Feedback on the current revision makes it REVIEWED again.
    await fx.as(s1).post(`/api/submissions/${await revisionOf(2)}/feedback`).send({ comment: 'Better. Ready to close.' }).expect(201);
    expect((await fx.as(a1).get(`/api/milestones/${M}`)).body.status).toBe('REVIEWED');
  });

  it('TEST-54 rejects feedback on a superseded revision with REVISION_SUPERSEDED', async () => {
    await submitFirst();
    const first = await revisionOf(1);
    await revise(a1).expect(201);
    const res = await fx.as(s1).post(`/api/submissions/${first}/feedback`).send({ comment });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REVISION_SUPERSEDED');
    expect(await prisma.feedback.count({ where: { submissionId: first } })).toBe(0);
    // The current revision still accepts feedback.
    await fx.as(s1).post(`/api/submissions/${await revisionOf(2)}/feedback`).send({ comment }).expect(201);
  });

  it('TEST-54 reports REVISION_SUPERSEDED before FEEDBACK_EXISTS and still hides other teams', async () => {
    await submitFirst();
    const first = await revisionOf(1);
    await fx.as(s1).post(`/api/submissions/${first}/feedback`).send({ comment }).expect(201);
    await revise(a1).expect(201);
    const again = await fx.as(s1).post(`/api/submissions/${first}/feedback`).send({ comment });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REVISION_SUPERSEDED');
    const s2 = await fx.login('supervisor2@example.test');
    expect((await fx.as(s2).post(`/api/submissions/${first}/feedback`).send({ comment })).status).toBe(404);
    expect(await prisma.feedback.count({ where: { submissionId: first } })).toBe(1);
  });
});
