import type { Role } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import { jsonOnly } from './json-only.js';
import type { AuthOptions } from '../auth/routes.js';
import { createRequireAuth } from './require-auth.js';
import { requireRole } from './require-role.js';
import { AuthorizedTeamAccess, denyAllTeamAccess, type TeamAccessRepo } from './team-access.js';

const MAX_BODY = '10kb';

// What feature routes use to protect themselves. Built once per app.
export interface SecurityKit {
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
  // Body handling for routes that take JSON. Put it AFTER requireAuth and requireRole so a
  // missing session (401) or wrong role (403) is never masked by a body error (415, 413, 400).
  jsonBody: RequestHandler[];
  teams: AuthorizedTeamAccess;
}

export function createSecurityKit(auth: AuthOptions, teamRepo: TeamAccessRepo = denyAllTeamAccess): SecurityKit {
  return {
    requireAuth: createRequireAuth(auth.store, auth.clock),
    requireRole,
    jsonBody: [jsonOnly, express.json({ limit: MAX_BODY })],
    teams: new AuthorizedTeamAccess(teamRepo),
  };
}
