import type { Prisma, PrismaClient } from '@prisma/client';
import type { Express, RequestHandler } from 'express';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { pickFields } from '../security/dto.js';
import type { SecurityKit } from '../security/kit.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { parse, uuidSchema } from '../security/validate.js';
import { milestoneStatus } from './status.js';

const personFields = { id: true, name: true } as const;
const milestoneFields = { id: true, title: true, dueAt: true } as const;
const teamSelect = {
  id: true,
  name: true,
  supervisor: { select: personFields },
  members: {
    orderBy: [{ student: { name: 'asc' } }, { studentId: 'asc' }],
    select: { student: { select: personFields } },
  },
  milestones: {
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    select: {
      ...milestoneFields,
      submission: { select: { feedback: { select: { id: true } } } },
    },
  },
} satisfies Prisma.TeamSelect;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;

function teamDto({ id, name, supervisor, members }: TeamRow) {
  return { id, name, supervisor, members: members.map(({ student }) => student) };
}

function milestoneDto(milestone: TeamRow['milestones'][number], now: Date) {
  return { ...pickFields(milestone, ['id', 'title', 'dueAt']), status: milestoneStatus(milestone, now) };
}

const progressKey = {
  NOT_SUBMITTED: 'notSubmitted',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  OVERDUE: 'overdue',
} as const;

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function mountScopedViews(
  app: Express, security: SecurityKit, prisma: PrismaClient, clock: Clock,
): void {
  app.get('/api/teams', noStore, security.requireAuth, async (req, res) => {
    const where = teamWhere(scopeFor(req.principal!));
    const rows = await prisma.team.findMany({ where, select: teamSelect, orderBy: { name: 'asc' } });
    const now = clock.now();
    const teams = rows.map(team => {
      const progress = { notSubmitted: 0, submitted: 0, reviewed: 0, overdue: 0 };
      let nextDue: Pick<TeamRow['milestones'][number], 'id' | 'title' | 'dueAt'> | null = null;
      for (const milestone of team.milestones) {
        const status = milestoneStatus(milestone, now);
        progress[progressKey[status]]++;
        if (status === 'NOT_SUBMITTED' && nextDue === null) {
          nextDue = pickFields(milestone, ['id', 'title', 'dueAt']);
        }
      }
      return { ...teamDto(team), progress, nextDue };
    });
    res.json({ teams });
  });

  app.get('/api/teams/:teamId', noStore, security.requireAuth, async (req, res) => {
    const id = parse(uuidSchema, req.params.teamId);
    const where = { ...teamWhere(scopeFor(req.principal!)), id };
    const team = await prisma.team.findFirst({ where, select: teamSelect });
    if (!team) throw AppError.notFound();

    const now = clock.now();
    res.json({ ...teamDto(team), milestones: team.milestones.map(milestone => milestoneDto(milestone, now)) });
  });

  app.get('/api/milestones/:milestoneId', noStore, security.requireAuth, async (req, res) => {
    const id = parse(uuidSchema, req.params.milestoneId);
    const milestone = await prisma.milestone.findFirst({
      where: { id, team: teamWhere(scopeFor(req.principal!)) },
      select: {
        ...milestoneFields,
        teamId: true,
        description: true,
        submission: {
          select: {
            id: true, title: true, description: true, link: true, submittedAt: true,
            feedback: { select: { id: true, comment: true, createdAt: true } },
          },
        },
      },
    });
    if (!milestone) throw AppError.notFound();

    res.json({ ...milestone, status: milestoneStatus(milestone, clock.now()) });
  });
}
