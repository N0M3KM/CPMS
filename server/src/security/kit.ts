import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import type { AuthOptions } from '../auth/routes.js';
import { createRequireAuth } from './require-auth.js';
import { requireRole } from './require-role.js';
import { AuthorizedTeamAccess, denyAllTeamAccess, type TeamAccessRepo } from './team-access.js';

// What feature routes use to protect themselves. Built once per app.
export interface SecurityKit {
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
  teams: AuthorizedTeamAccess;
}

export function createSecurityKit(auth: AuthOptions, teamRepo: TeamAccessRepo = denyAllTeamAccess): SecurityKit {
  return {
    requireAuth: createRequireAuth(auth.store, auth.clock),
    requireRole,
    teams: new AuthorizedTeamAccess(teamRepo),
  };
}
