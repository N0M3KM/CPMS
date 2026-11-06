import { createApp } from './platform/app.js';
import { loadConfig } from './platform/config.js';
import { createPrisma, dbChecker } from './platform/db.js';

const config = loadConfig(process.env);
const prisma = createPrisma(config.databaseUrl);
const app = createApp({ checkDb: dbChecker(prisma) });

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
