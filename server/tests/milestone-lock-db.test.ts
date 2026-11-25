import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lockMilestone } from '../src/domain/closed.js';
import { createApiFixture, id, validSubmission } from './helpers/api-fixture.js';
import { createTestPrisma } from './helpers/db.js';

// Held-lock race tests: a separate transaction takes the milestone row lock and writes (a new revision, or a close);
// a request that needs the same lock must wait, then see the committed write and refuse. If a service stops taking
// lockMilestone, it does not wait, the waiter check below fails and the request wrongly succeeds.
const prisma = createTestPrisma();
const fx = createApiFixture(prisma);
const M = id(202);
let s1: string; let a1: string;

beforeEach(async () => {
  await fx.reset();
  s1 = await fx.login('supervisor1@example.test');
  a1 = await fx.login('student.a1@example.test');
  await fx.as(a1).post(`/api/milestones/${M}/submission`).send(validSubmission).expect(201);
});
afterAll(() => prisma.$disconnect());

const code = (res: { status: number; body: { error?: { code?: string } } }) => [res.status, res.body.error?.code];
const rev1 = async () => (await prisma.submission.findFirstOrThrow({ where: { milestoneId: M, revisionNo: 1 } })).id;

async function waiterSeen(timeoutMs = 4000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`;
    if ((rows[0]?.n ?? 0n) > 0n) return true;
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

// Runs `write` inside a transaction that holds the milestone lock, starts `request`, waits until it is blocked on
// the lock, commits the write and returns the request's response together with whether it was seen waiting.
async function raceWithHeldLock<T>(write: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>, request: () => PromiseLike<T>) {
  let release!: () => void; let locked!: () => void;
  const held = new Promise<void>(r => { release = r; });
  const lockTaken = new Promise<void>(r => { locked = r; });
  const writer = prisma.$transaction(async (tx) => {
    await lockMilestone(tx, M);
    await write(tx);
    locked();
    await held;
  });
  await lockTaken;
  const pending = request();
  const waited = await waiterSeen();
  release();
  await writer;
  return { waited, response: await pending };
}

const insertRevision2 = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) =>
  tx.submission.create({
    data: { milestoneId: M, revisionNo: 2, title: 'Second version', description: 'd'.repeat(20), link: 'https://example.test/v2', submittedById: id(11), submittedAt: fx.clock.now() },
  }).then(() => undefined);

describe('milestone row lock is shared by every write that depends on the current revision', () => {
  it('TEST-54b feedback waits for a revision that commits first and is then refused with REVISION_SUPERSEDED', async () => {
    const target = await rev1();
    const { waited, response } = await raceWithHeldLock(insertRevision2,
      () => fx.as(s1).post(`/api/submissions/${target}/feedback`).send({ comment: 'Please add measurable goals.' }).then(res => res));
    expect(waited).toBe(true);
    expect(code(response)).toEqual([409, 'REVISION_SUPERSEDED']);
    expect(await prisma.feedback.count({ where: { submissionId: target } })).toBe(0);   // the seed has other feedback rows
  });

  it('TEST-87b a grade waits for a revision that commits first and is then refused with REVISION_SUPERSEDED', async () => {
    const target = await rev1();
    await fx.as(s1).post(`/api/submissions/${target}/feedback`).send({ comment: 'Please add measurable goals.' }).expect(201);
    const { waited, response } = await raceWithHeldLock(insertRevision2,
      () => fx.as(s1).post(`/api/submissions/${target}/grade`).send({ score: 70 }).then(res => res));
    expect(waited).toBe(true);
    expect(code(response)).toEqual([409, 'REVISION_SUPERSEDED']);
    expect(await prisma.grade.count()).toBe(0);
  });

  it('TEST-47b a revision waits for a close that commits first and is then refused with MILESTONE_CLOSED', async () => {
    const { waited, response } = await raceWithHeldLock(
      tx => tx.milestone.update({ where: { id: M }, data: { closedAt: fx.clock.now() } }).then(() => undefined),
      () => fx.as(a1).post(`/api/milestones/${M}/revisions`).send(validSubmission).then(res => res));
    expect(waited).toBe(true);
    expect(code(response)).toEqual([409, 'MILESTONE_CLOSED']);
    expect(await prisma.submission.count({ where: { milestoneId: M } })).toBe(1);
  });
});
