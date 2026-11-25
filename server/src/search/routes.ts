import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import type { Clock } from '../platform/clock.js';
import type { SecurityKit } from '../security/kit.js';
import { principalOf } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { parse } from '../security/validate.js';
import { noStore } from '../views/no-store.js';
import { milestoneStatus } from '../views/status.js';
import { searchQuerySchema } from './policy.js';

const MAX_SCANNED = 1000;

export function mountSearch(app: Express, security: SecurityKit, prisma: PrismaClient, clock: Clock): void {
  app.get('/api/search', noStore, security.requireAuth, async (req, res) => {
    const { q, status, teamId, page, limit } = parse(searchQuerySchema, req.query);
    const principal = principalOf(req);
    if (teamId) await security.teams.requireTeam(principal, teamId);

    const rows = await prisma.milestone.findMany({
      where: {
        team: teamWhere(scopeFor(principal)),
        teamId,
        // Prisma uses ILIKE here. Escape the pattern syntax so the query matches literal text.
        title: q ? { contains: q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } : undefined,
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: MAX_SCANNED,
      select: {
        id: true, teamId: true, title: true, dueAt: true, closedAt: true,
        submissions: { orderBy: { revisionNo: 'desc' }, take: 1, select: { feedback: { select: { id: true } } } },
      },
    });
    const now = clock.now();
    const matches = rows.map(({ id, teamId, title, dueAt, closedAt, submissions }) => ({
      id, teamId, title, dueAt,
      status: milestoneStatus({ dueAt, closedAt, submission: submissions[0] ?? null }, now),
    })).filter(item => !status || item.status === status);
    const offset = (page - 1) * limit;
    res.json({ items: matches.slice(offset, offset + limit), total: matches.length, page, limit });
  });
}
