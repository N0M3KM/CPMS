import { z } from 'zod';

const MIN_SECRET_LENGTH = 16;

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SESSION_SECRET: z.string().optional(),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(8),
    // Required in production (the development default would silently allow the wrong origin).
    ALLOWED_ORIGIN: z.string().url().optional(),
    // Number of trusted proxy hops in front of the app (Cloud Run: 1). 0 = trust none.
    TRUST_PROXY: z.string().regex(/^[0-5]$/, 'TRUST_PROXY must be a whole number from 0 to 5').default('0').transform(Number),
    // Built client directory to serve from the same process (single-container deployment).
    CLIENT_DIST: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if ((env.SESSION_SECRET?.length ?? 0) < MIN_SECRET_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
      });
    }
    const origin = env.ALLOWED_ORIGIN;
    const secureOrigin = origin !== undefined && (origin.startsWith('https://') || /^http:\/\/localhost(:\d+)?$/.test(origin));
    if (!secureOrigin) {
      ctx.addIssue({
        code: 'custom',
        path: ['ALLOWED_ORIGIN'],
        message: 'ALLOWED_ORIGIN must be set to the public https URL (or http://localhost) in production',
      });
    }
  });

export interface AppConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  sessionSecret: string | undefined;
  sessionTtlHours: number;
  allowedOrigin: string;
  trustProxy: number;
  clientDist: string | undefined;
}

// Validates the environment once at startup. Error messages name variables, never values.
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'environment'))];
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'environment'}: ${i.message}`);
    throw new Error(`Invalid configuration (${names.join(', ')}): ${details.join('; ')}`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.PORT,
    nodeEnv: e.NODE_ENV,
    sessionSecret: e.SESSION_SECRET,
    sessionTtlHours: e.SESSION_TTL_HOURS,
    allowedOrigin: e.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    trustProxy: e.TRUST_PROXY,
    clientDist: e.CLIENT_DIST,
  };
}
