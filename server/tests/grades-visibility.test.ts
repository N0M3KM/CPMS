import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

// F-10 grade visibility through GET /api/milestones/:id (revisions[] from F-08). Seed: milestone 201 (Team A) has
// submission 301 with feedback; Team B and Team C belong to other students and supervisors.
const prisma = createTestPrisma();
const fx = createApiFixture(prisma);
const M = id(201);
const SUBMISSION = id(301);
let s1: string; let s2: string; let a1: string; let b1: string;

beforeEach(async () => {
  await fx.reset();   // a fresh app per test, so the request limiter never reaches 429
  s1 = await fx.login('supervisor1@example.test');
  s2 = await fx.login('supervisor2@example.test');
  a1 = await fx.login('student.a1@example.test');
  b1 = await fx.login('student.b1@example.test');
});
afterAll(() => prisma.$disconnect());

const grade = (score: number) => fx.as(s1).post(`/api/submissions/${SUBMISSION}/grade`).send({ score });
const read = (cookie: string, milestoneId = M) => fx.as(cookie).get(`/api/milestones/${milestoneId}`);

describe('F-10 grades are read through revisions[]', () => {
  it('TEST-69 the team and its supervisor see the grade on the revision; before grading every grade is null', async () => {
    const before = await read(a1).expect(200);
    expect(before.body.revisions.every((r: { grade: unknown }) => r.grade === null)).toBe(true);
    await grade(90).expect(201);
    const own = await read(a1).expect(200);
    expect(own.body.revisions.at(-1).grade).toMatchObject({ score: 90, supervisor: { id: id(1) } });
    expect((await read(s1).expect(200)).body.revisions.at(-1).grade.score).toBe(90);
  });

  it('TEST-69 another team and another supervisor get the uniform 404 and no grade appears in their lists', async () => {
    await grade(90).expect(201);
    expect((await read(b1)).status).toBe(404);
    expect((await read(s2)).status).toBe(404);
    for (const [cookie, path] of [[b1, '/api/teams'], [b1, `/api/teams/${id(102)}`], [s2, '/api/teams'], [s2, `/api/teams/${id(103)}`]] as const) {
      const res = await fx.as(cookie).get(path).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('"score"');
    }
  });

  it('TEST-71 after a new revision the earlier revision keeps its grade and the new one has none', async () => {
    await grade(90).expect(201);
    await prisma.submission.create({
      data: { milestoneId: M, revisionNo: 2, title: 'Second version', description: 'd'.repeat(20), link: 'https://example.test/v2', submittedById: id(11), submittedAt: fx.clock.now() },
    });
    const res = await read(a1).expect(200);
    expect(res.body.revisions.map((r: { revisionNo: number; grade: { score: number } | null }) => [r.revisionNo, r.grade?.score ?? null]))
      .toEqual([[1, 90], [2, null]]);
  });

  it('TEST-72 the grade object has exactly score, createdAt and supervisor {id, name}; submission has no grade key', async () => {
    await grade(75).expect(201);
    const body = (await read(a1).expect(200)).body;
    const g = body.revisions.at(-1).grade;
    expect(Object.keys(g).sort()).toEqual(['createdAt', 'score', 'supervisor']);
    expect(Object.keys(g.supervisor).sort()).toEqual(['id', 'name']);
    expect(Object.keys(body.submission).sort()).toEqual(['description', 'feedback', 'id', 'link', 'submittedAt', 'title']);
  });

  it('TEST-90 (data side) a graded revision stays visible to the supervisor and the team after the milestone is closed', async () => {
    await grade(90).expect(201);
    await prisma.milestone.update({ where: { id: M }, data: { closedAt: fx.clock.now() } });
    expect((await read(a1).expect(200)).body.revisions.at(-1).grade.score).toBe(90);
    expect((await read(s1).expect(200)).body.revisions.at(-1).grade.score).toBe(90);
  });
});
