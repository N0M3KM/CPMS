import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { closeMilestone, patchBody, updateMilestone } from '../src/milestones/manage.js';
import { fixedClock } from '../src/platform/clock.js';
import { AppError } from '../src/platform/errors.js';

const NOW = new Date('2026-11-08T12:00:00Z');
const MILESTONE = '00000000-0000-4000-8000-000000000202';
const principal = { userId: '00000000-0000-4000-8000-000000000001', role: 'SUPERVISOR' as const };

describe('F-09 patch body (BR-03, strict schema)', () => {
  it('TEST-56 accepts each single field and a trimmed title of 5 to 100 characters', () => {
    expect(patchBody.safeParse({ title: '  Hello  ' })).toMatchObject({ success: true, data: { title: 'Hello' } });
    expect(patchBody.safeParse({ title: 'T'.repeat(100) }).success).toBe(true);
    expect(patchBody.safeParse({ description: '' }).success).toBe(true);
    expect(patchBody.safeParse({ description: 'd'.repeat(1000) }).success).toBe(true);
  });

  it.each([
    ['a 4 character title', { title: 'abcd' }],
    ['a title that is only spaces', { title: '        ' }],
    ['a 101 character title', { title: 'T'.repeat(101) }],
    ['a 1001 character description', { description: 'd'.repeat(1001) }],
    ['a non-string title', { title: 12345 }],
    ['an empty object', {}],
    ['an unknown field', { title: 'Valid title', teamId: 'x' }],
    ['an unknown field alone', { createdById: 'x' }],
    ['a dueAt without an offset', { dueAt: '2026-12-01T10:00:00' }],
    ['a dueAt that is only a date', { dueAt: '2026-12-01' }],
    ['a dueAt that is not a string', { dueAt: 1796000000000 }],
  ])('TEST-57 rejects %s', (_label, body) => {
    expect(patchBody.safeParse(body).success).toBe(false);
  });

  it('TEST-57 turns a dueAt with an offset into a Date', () => {
    const parsed = patchBody.safeParse({ dueAt: '2026-12-01T10:00:00+07:00' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.dueAt).toEqual(new Date('2026-12-01T03:00:00Z'));
  });
});

describe('F-09 deadline boundary (AC-57)', () => {
  function stubPrisma(updated = 1) {
    const updateMany = vi.fn().mockResolvedValue({ count: updated });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: MILESTONE });
    return { prisma: { milestone: { updateMany, findUniqueOrThrow, findFirst: vi.fn() } } as unknown as PrismaClient, updateMany };
  }

  it('TEST-57 rejects a dueAt equal to now and one in the past without writing', async () => {
    const clock = fixedClock(NOW);
    const { prisma, updateMany } = stubPrisma();
    for (const dueAt of [NOW, new Date(NOW.getTime() - 1)]) {
      await expect(updateMilestone(prisma, principal, MILESTONE, { dueAt }, clock))
        .rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('TEST-57 accepts a dueAt one millisecond after now, earlier or later than the old one', async () => {
    const clock = fixedClock(NOW);
    const { prisma, updateMany } = stubPrisma();
    await updateMilestone(prisma, principal, MILESTONE, { dueAt: new Date(NOW.getTime() + 1) }, clock);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('TEST-57 does not check the clock when no dueAt is sent', async () => {
    const { prisma, updateMany } = stubPrisma();
    await updateMilestone(prisma, principal, MILESTONE, { title: 'Valid title' }, fixedClock(NOW));
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('TEST-58 filters the write on the open state and the session supervisor, never on a client id', async () => {
    const { prisma, updateMany } = stubPrisma();
    await updateMilestone(prisma, principal, MILESTONE, { title: 'Valid title' }, fixedClock(NOW));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: MILESTONE, team: { supervisorId: principal.userId }, closedAt: null },
      data: { title: 'Valid title' },
    });
  });
});

describe('F-09 close (AC-59)', () => {
  it('TEST-59 reads the clock once and stores and returns the same instant', async () => {
    const base = fixedClock(NOW);
    const now = vi.fn(() => base.now());
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { milestone: { updateMany, findFirst: vi.fn() } } as unknown as PrismaClient;
    const result = await closeMilestone(prisma, principal, MILESTONE, { now });
    expect(now).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: MILESTONE, closedAt: NOW });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: MILESTONE, team: { supervisorId: principal.userId }, closedAt: null },
      data: { closedAt: NOW },
    });
  });

  it('TEST-59 reports ALREADY_CLOSED when the row is in scope but already closed, 404 when it is not in scope', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findFirst = vi.fn().mockResolvedValueOnce({ id: MILESTONE }).mockResolvedValueOnce(null);
    const prisma = { milestone: { updateMany, findFirst } } as unknown as PrismaClient;
    const closed = await closeMilestone(prisma, principal, MILESTONE, fixedClock(NOW)).catch((error: unknown) => error);
    expect(closed).toBeInstanceOf(AppError);
    expect(closed).toMatchObject({ status: 409, code: 'ALREADY_CLOSED' });
    const missing = await closeMilestone(prisma, principal, MILESTONE, fixedClock(NOW)).catch((error: unknown) => error);
    expect(missing).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
