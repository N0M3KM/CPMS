import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import { mountMilestoneWrites } from './milestones/routes.js';
import type { Clock } from './platform/clock.js';
import type { SecurityKit } from './security/kit.js';
import { mountSubmissionWrites } from './submissions/routes.js';
import { mountScopedViews } from './views/routes.js';

// Single list of feature routes. server.ts and the tests both use it, so the route matrix
// test sees exactly the routes that production serves.
export function mountFeatureRoutes(app: Express, security: SecurityKit, prisma: PrismaClient, clock: Clock): void {
  mountScopedViews(app, security, prisma, clock);
  mountMilestoneWrites(app, security, prisma, clock);
  mountSubmissionWrites(app, security, prisma, clock);
}
