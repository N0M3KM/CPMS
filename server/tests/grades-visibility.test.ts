import { describe, it } from 'vitest';

// These assertions read grades through GET /api/milestones/:id, specifically revisions[], which F-08 adds.
// F-08 is built in another worktree, so they stay as todo here. The integration owner turns each it.todo into a
// real test after F-08 merges, using createApiFixture from ./helpers/api-fixture.js, with this setup:
//   fx.reset(); s1 = login(supervisor1), a1 = login(student.a1), b1 = login(student.b1), s2 = login(supervisor2)
//   grade posted as: fx.as(s1).post(`/api/submissions/${id(301)}/grade`).send({ score: 90 }) -> 201
describe('F-10 grade visibility through revisions[] (needs F-08)', () => {
  it.todo('TEST-69 team member and supervisor see the grade in revisions[]');
  // const own = await fx.as(a1).get(`/api/milestones/${id(201)}`).expect(200);
  // expect(own.body.revisions.at(-1).grade).toMatchObject({ score: 90, supervisor: { id: id(1), name: 'Supervisor One' } });
  // const sup = await fx.as(s1).get(`/api/milestones/${id(201)}`).expect(200);
  // expect(sup.body.revisions.at(-1).grade.score).toBe(90);

  it.todo('TEST-69 another team gets the uniform 404 and no grade appears in its lists');
  // expect((await fx.as(b1).get(`/api/milestones/${id(201)}`)).status).toBe(404);
  // expect((await fx.as(s2).get(`/api/milestones/${id(201)}`)).status).toBe(404);
  // const list = await fx.as(b1).get(`/api/teams/${id(102)}`).expect(200);
  // expect(JSON.stringify(list.body)).not.toContain('"score"');   // also GET /api/teams as b1 and as s2

  it.todo('TEST-69 a revision with feedback and no grade shows grade: null; before grading every revision has grade: null');
  // const before = await fx.as(a1).get(`/api/milestones/${id(201)}`).expect(200);
  // expect(before.body.revisions.every((r: { grade: unknown }) => r.grade === null)).toBe(true);

  it.todo('TEST-71 after a new revision the earlier revision keeps its grade and the new one has grade: null');
  // grade 301 (90), then POST the second revision through the F-08 route as a1 (or create revisionNo 2 with Prisma), then:
  // const res = await fx.as(a1).get(`/api/milestones/${id(201)}`).expect(200);
  // expect(res.body.revisions.map((r: { grade: { score: number } | null }) => r.grade?.score ?? null)).toEqual([90, null]);

  it.todo('TEST-72 the grade object inside revisions[] has exactly score, createdAt and supervisor {id, name}');
  // const g = (await fx.as(a1).get(`/api/milestones/${id(201)}`).expect(200)).body.revisions.at(-1).grade;
  // expect(Object.keys(g).sort()).toEqual(['createdAt', 'score', 'supervisor']);
  // expect(Object.keys(g.supervisor).sort()).toEqual(['id', 'name']);
  // and the six Sprint 1 keys of body.submission are unchanged (no grade key on submission).

  it.todo('TEST-90 data side: a graded revision stays visible to the supervisor and the team after the milestone is closed');
  // await prisma.milestone.update({ where: { id: id(201) }, data: { closedAt: fx.clock.now() } });
  // expect((await fx.as(a1).get(`/api/milestones/${id(201)}`)).body.revisions.at(-1).grade.score).toBe(90);
});
