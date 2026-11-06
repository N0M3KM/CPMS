import { prismaAuthStore } from './auth/store.js';
import { createApp } from './platform/app.js';
import { systemClock } from './platform/clock.js';
import { loadConfig } from './platform/config.js';
import { createPrisma, dbChecker } from './platform/db.js';
import { prismaTeamAccess } from './security/team-access.js';
import { mountScopedViews } from './views/routes.js';

const config = loadConfig(process.env);
const prisma = createPrisma(config.databaseUrl);
const app = createApp({
  checkDb: dbChecker(prisma),
  teamAccess: prismaTeamAccess(prisma),
  mountRoutes: (app, security) => mountScopedViews(app, security, prisma, systemClock),
  auth: {
    store: prismaAuthStore(prisma),
    clock: systemClock,
    ttlHours: config.sessionTtlHours,
    secure: config.nodeEnv === 'production',
    allowedOrigin: config.allowedOrigin,
  },
});

const server = app.listen(config.port, () => {
  console.log(`CPMS server listening on port ${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
