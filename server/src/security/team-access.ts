import type { PrismaClient } from '@prisma/client';
import { AppError } from '../platform/errors.js';
import type { Principal } from './principal.js';
import { uuidSchema } from './validate.js';

export interface TeamRef {
  id: string;
  supervisorId: string;
}

// Strategy data: which teams a principal may see. A student sees the team they belong to;
// a supervisor sees the teams they supervise.
export type TeamScope = { kind: 'STUDENT'; studentId: string } | { kind: 'SUPERVISOR'; supervisorId: string };

export function scopeFor(principal: Principal): TeamScope {
  return principal.role === 'STUDENT'
    ? { kind: 'STUDENT', studentId: principal.userId }
    : { kind: 'SUPERVISOR', supervisorId: principal.userId };
}

export interface TeamAccessRepo {
  findTeamInScope(scope: TeamScope, teamId: string): Promise<TeamRef | null>;
}

// Protection proxy over team lookups: callers get a team only if it is in the principal's scope.
// Foreign and nonexistent teams raise the same error, so they cannot be told apart.
export class AuthorizedTeamAccess {
  constructor(private readonly repo: TeamAccessRepo) {}

  async requireTeam(principal: Principal, teamId: string): Promise<TeamRef> {
    if (!uuidSchema.safeParse(teamId).success) throw AppError.notFound();
    const team = await this.repo.findTeamInScope(scopeFor(principal), teamId);
    if (!team) throw AppError.notFound();
    return team;
  }
}

export function prismaTeamAccess(prisma: PrismaClient): TeamAccessRepo {
  return {
    findTeamInScope(scope, teamId) {
      const where =
        scope.kind === 'STUDENT'
          ? { id: teamId, members: { some: { studentId: scope.studentId } } }
          : { id: teamId, supervisorId: scope.supervisorId };
      return prisma.team.findFirst({ where, select: { id: true, supervisorId: true } });
    },
  };
}

// Safe default when no repository is wired: nothing is in scope.
export const denyAllTeamAccess: TeamAccessRepo = { findTeamInScope: async () => null };
