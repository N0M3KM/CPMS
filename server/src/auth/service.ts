import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Role } from '@prisma/client';
import type { Clock } from '../platform/clock.js';

export const BCRYPT_ROUNDS = 10;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserCredentials extends SessionUser {
  passwordHash: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface AuthStore {
  findCredentials(email: string): Promise<UserCredentials | null>;
  rotateSession(session: Session, previousId: string | undefined): Promise<void>;
  findSessionUser(id: string, now: Date): Promise<SessionUser | null>;
  revokeSession(id: string, now: Date): Promise<boolean>;
}

export function createAuthService(store: AuthStore, clock: Clock, ttlHours: number) {
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

  return {
    async login(email: string, password: string, previousId: string | undefined) {
      const credentials = await store.findCredentials(email);
      const matches = await bcrypt.compare(password, credentials?.passwordHash ?? dummyHash);
      if (!credentials || !matches) return null;

      const user = { id: credentials.id, email: credentials.email, name: credentials.name, role: credentials.role };
      const session: Session = {
        id: randomBytes(32).toString('base64url'),
        userId: user.id,
        expiresAt: new Date(clock.now().getTime() + ttlHours * 3_600_000),
      };
      await store.rotateSession(session, previousId);
      return { user, session };
    },
    async me(id: string | undefined) {
      const user = id && await store.findSessionUser(id, clock.now());
      return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
    },
    async logout(id: string | undefined) {
      return id ? store.revokeSession(id, clock.now()) : false;
    },
  };
}
