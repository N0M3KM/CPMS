import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiFixture, id } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

const prisma = createTestPrisma();
const fx = createApiFixture(prisma);

describe('Sprint 2 API fixture', () => {
  beforeEach(() => fx.reset());
  afterAll(() => prisma.$disconnect());

  it('resets, seeds and signs in users one after another, then reads a Team A milestone', async () => {
    const a1 = await fx.login('student.a1@example.test');
    const a2 = await fx.login('student.a2@example.test');
    const s1 = await fx.login('supervisor1@example.test');
    const b1 = await fx.login('student.b1@example.test');
    const own = await fx.as(a1).get(`/api/milestones/${id(202)}`).expect(200);
    expect(own.body).toMatchObject({ id: id(202), teamId: id(101), status: 'NOT_SUBMITTED', closedAt: null, submission: null });
    await fx.as(a2).get(`/api/milestones/${id(202)}`).expect(200);
    await fx.as(s1).get(`/api/milestones/${id(202)}`).expect(200);
    await fx.as(b1).get(`/api/milestones/${id(202)}`).expect(404);   // another team: the uniform 404
  });
});
