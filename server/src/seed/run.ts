import { loadConfig } from '../platform/config.js';
import { systemClock } from '../platform/clock.js';
import { createPrisma } from '../platform/db.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const prisma = createPrisma(config.databaseUrl);
  try {
    await seedDatabase(prisma, {
      studentPassword: process.env.SEED_STUDENT_PASSWORD ?? '',
      supervisorPassword: process.env.SEED_SUPERVISOR_PASSWORD ?? '',
      clock: systemClock,
      logger: { log: (m) => console.log(m) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'Seed failed');
  process.exit(1);
});
