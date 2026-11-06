import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/platform/errors.js';
import { AuthorizedTeamAccess, scopeFor, type TeamAccessRepo } from '../src/security/team-access.js';

describe('scopeFor', () => {
  it('builds a student scope from the principal id', () => {
    expect(scopeFor({ userId: 'u1', role: 'STUDENT' })).toEqual({ kind: 'STUDENT', studentId: 'u1' });
  });
  it('builds a supervisor scope from the principal id', () => {
    expect(scopeFor({ userId: 'u2', role: 'SUPERVISOR' })).toEqual({ kind: 'SUPERVISOR', supervisorId: 'u2' });
  });
});

describe('AuthorizedTeamAccess', () => {
  it('queries with the principal scope and returns the team when found', async () => {
    const repo: TeamAccessRepo = { findTeamInScope: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', supervisorId: 's' }) };
    const team = await new AuthorizedTeamAccess(repo).requireTeam({ userId: 'u1', role: 'STUDENT' }, '11111111-1111-4111-8111-111111111111');
    expect(team).toEqual({ id: '11111111-1111-4111-8111-111111111111', supervisorId: 's' });
    expect(repo.findTeamInScope).toHaveBeenCalledWith({ kind: 'STUDENT', studentId: 'u1' }, '11111111-1111-4111-8111-111111111111');
  });

  it('throws the same not-found error whether the team is foreign or missing', async () => {
    const repo: TeamAccessRepo = { findTeamInScope: vi.fn().mockResolvedValue(null) };
    const access = new AuthorizedTeamAccess(repo);
    const a = await access.requireTeam({ userId: 'u1', role: 'STUDENT' }, '22222222-2222-4222-8222-222222222222').catch((e: unknown) => e);
    const b = await access.requireTeam({ userId: 'u1', role: 'STUDENT' }, '99999999-9999-4999-8999-999999999999').catch((e: unknown) => e);
    expect(a).toBeInstanceOf(AppError);
    expect((a as AppError).status).toBe(404);
    expect((b as AppError).code).toBe((a as AppError).code);
    expect((b as AppError).message).toBe((a as AppError).message);
  });

  it('returns the generic validation error for a malformed team ID and never queries (review finding 2)', async () => {
    const repo: TeamAccessRepo = { findTeamInScope: vi.fn() };
    const access = new AuthorizedTeamAccess(repo);
    for (const bad of ['not-a-uuid', "' OR 1=1--", '../../etc/passwd', '', '1234']) {
      const err = await access.requireTeam({ userId: 'u1', role: 'STUDENT' }, bad).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(400);
      expect((err as AppError).code).toBe('VALIDATION_ERROR');
      expect((err as AppError).message).not.toContain(bad || 'x');
    }
    expect(repo.findTeamInScope).not.toHaveBeenCalled();
  });
});
