import type { PrismaClient } from '@prisma/client';
import type { AuthStore } from './service.js';

const publicUserFields = { id: true, email: true, name: true, role: true } as const;

export function prismaAuthStore(prisma: PrismaClient): AuthStore {
  return {
    findCredentials(email) {
      return prisma.user.findUnique({
        where: { email },
        select: { ...publicUserFields, passwordHash: true },
      });
    },
    async rotateSession(session, previousId) {
      await prisma.$transaction(async tx => {
        if (previousId) await tx.session.deleteMany({ where: { id: previousId } });
        await tx.session.create({ data: session });
      });
    },
    async findSessionUser(id, now) {
      const session = await prisma.session.findUnique({
        where: { id, expiresAt: { gt: now } },
        select: { user: { select: publicUserFields } },
      });
      return session?.user ?? null;
    },
    async revokeSession(id, now) {
      const result = await prisma.session.deleteMany({ where: { id, expiresAt: { gt: now } } });
      return result.count > 0;
    },
  };
}
