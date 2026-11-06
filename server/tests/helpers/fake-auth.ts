import bcrypt from 'bcrypt';
import request from 'supertest';
import type { Express } from 'express';
import type { AuthStore, Session, UserCredentials } from '../../src/auth/service.js';
import { createApp, type AppDeps } from '../../src/platform/app.js';
import { fixedClock } from '../../src/platform/clock.js';
import type { TeamAccessRepo, TeamRef, TeamScope } from '../../src/security/team-access.js';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'synthetic-test-password';

export const TEAM_A = '11111111-1111-4111-8111-111111111111';
export const TEAM_B = '22222222-2222-4222-8222-222222222222';
export const TEAM_C = '33333333-3333-4333-8333-333333333333';
export const MISSING_TEAM = '99999999-9999-4999-8999-999999999999';

const user = (id: string, role: 'STUDENT' | 'SUPERVISOR') =>
  ({ id, email: `${id}@example.test`, name: id, role }) as const;
export const A1 = user('a1', 'STUDENT');
export const B1 = user('b1', 'STUDENT');
export const S1 = user('s1', 'SUPERVISOR');
export const S2 = user('s2', 'SUPERVISOR');
const USERS = [A1, B1, S1, S2];

const TEAMS: Array<TeamRef & { memberIds: string[] }> = [
  { id: TEAM_A, supervisorId: 's1', memberIds: ['a1'] },
  { id: TEAM_B, supervisorId: 's1', memberIds: ['b1'] },
  { id: TEAM_C, supervisorId: 's2', memberIds: ['c1'] },
];

// In-memory team lookup that applies the same scope rule as the real repository.
export const fakeTeamRepo: TeamAccessRepo = {
  async findTeamInScope(scope: TeamScope, teamId: string) {
    const team = TEAMS.find((t) => t.id === teamId);
    if (!team) return null;
    const inScope =
      scope.kind === 'STUDENT' ? team.memberIds.includes(scope.studentId) : team.supervisorId === scope.supervisorId;
    return inScope ? { id: team.id, supervisorId: team.supervisorId } : null;
  },
};

let passwordHash: string | undefined;

export async function createFixture(options: { mountRoutes?: AppDeps['mountRoutes'] } = {}) {
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  const clock = fixedClock(new Date('2026-11-06T08:00:00Z'));
  const users: UserCredentials[] = USERS.map((u) => ({ ...u, passwordHash: passwordHash! }));
  const sessions = new Map<string, Session>();
  const store: AuthStore = {
    async findCredentials(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async rotateSession(session, previousId) {
      if (previousId) sessions.delete(previousId);
      sessions.set(session.id, session);
    },
    async findSessionUser(id, now) {
      const s = sessions.get(id);
      return s && s.expiresAt > now ? (users.find((u) => u.id === s.userId) ?? null) : null;
    },
    async revokeSession(id, now) {
      const s = sessions.get(id);
      return !!s && s.expiresAt > now && sessions.delete(id);
    },
  };
  const app: Express = createApp({
    checkDb: async () => undefined,
    auth: { store, clock, ttlHours: 1, secure: false, allowedOrigin: ORIGIN },
    teamAccess: fakeTeamRepo,
    ...(options.mountRoutes ? { mountRoutes: options.mountRoutes } : {}),
  });
  const api = request(app);

  async function login(who: { email: string }): Promise<string> {
    const res = await api.post('/api/auth/login').set('Origin', ORIGIN).send({ email: who.email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`fixture login failed: ${res.status}`);
    const cookies = res.get('set-cookie');
    return (Array.isArray(cookies) ? cookies[0] : cookies)?.split(';')[0] ?? '';
  }

  return { app, api, clock, sessions, login };
}
