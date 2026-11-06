import { systemClock } from '../server/src/platform/clock.js';
import { seedDatabase } from '../server/src/seed/seed.js';
import { createTestPrisma, resetDb } from '../server/tests/helpers/db.js';

async function main(): Promise<void> {
  // createTestPrisma refuses any database whose name does not end in _test.
  const prisma = createTestPrisma();
  try {
    await resetDb(prisma);
    await seedDatabase(prisma, {
      studentPassword: process.env.SEED_STUDENT_PASSWORD ?? '',
      supervisorPassword: process.env.SEED_SUPERVISOR_PASSWORD ?? '',
      clock: systemClock,
      logger: { log: (message) => console.log(message) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'E2E preparation failed');
  process.exit(1);
});
