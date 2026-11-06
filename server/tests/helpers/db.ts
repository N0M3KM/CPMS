import { PrismaClient } from '@prisma/client';

export function createTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '';
  if (!dbName.endsWith('_test')) throw new Error('Test helper refuses non-test database');
  return new PrismaClient({ datasources: { db: { url } } });
}

// Deletes every row in child-first order. Only ever called on the _test database.
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.feedback.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
