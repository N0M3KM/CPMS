import { PrismaClient } from '@prisma/client';

export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

export function dbChecker(prisma: PrismaClient): () => Promise<void> {
  return async () => {
    await prisma.$queryRaw`SELECT 1`;
  };
}
