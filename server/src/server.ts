import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { prismaAuthStore } from './auth/store.js';
import { createApp } from './platform/app.js';
import { systemClock } from './platform/clock.js';
import { loadConfig } from './platform/config.js';
import { createPrisma, dbChecker } from './platform/db.js';
import { prismaTeamAccess } from './security/team-access.js';
import { mountFeatureRoutes } from './routes.js';

const config = loadConfig(process.env);
const prisma = createPrisma(config.databaseUrl);
// Serve the built client when asked to, or by default in production (single container).
const clientDist = config.clientDist ?? (config.nodeEnv === 'production' ? resolve(process.cwd(), '../client/dist') : undefined);

const app = createApp({
  checkDb: dbChecker(prisma),
  trustProxy: config.trustProxy,
  ...(process.env.APP_COMMIT ? { commit: process.env.APP_COMMIT } : {}),
  ...(clientDist && existsSync(join(clientDist, 'index.html')) ? { staticDir: clientDist } : {}),
  teamAccess: prismaTeamAccess(prisma),
  mountRoutes: (app, security) => mountFeatureRoutes(app, security, prisma, systemClock),
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
