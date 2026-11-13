import { systemClock } from '../platform/clock.js';
import { createPrisma } from '../platform/db.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  // The migration job only has DATABASE_URL and the seed passwords, so it does not load the full app config.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
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
