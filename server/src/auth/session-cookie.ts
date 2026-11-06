export const COOKIE_NAME = 'cpms_session';
const COOKIE_PREFIX = `${COOKIE_NAME}=`;
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

// Returns the session ID only when exactly one well-formed session cookie is present.
export function sessionIdFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  const cookies = cookieHeader?.split(';').map((cookie) => cookie.trim());
  const sessions = cookies?.filter((cookie) => cookie.startsWith(COOKIE_PREFIX)) ?? [];
  const value = sessions.length === 1 ? sessions[0]?.slice(COOKIE_PREFIX.length) : undefined;
  return value && SESSION_ID.test(value) ? value : undefined;
}
