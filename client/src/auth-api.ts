export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'SUPERVISOR';
}

export class AuthError extends Error {
  constructor(public readonly status: number) {
    super('Authentication request failed.');
  }
}

async function authRequest(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/auth${path}`, options);
  if (!response.ok) throw new AuthError(response.status);
  return response;
}

export async function currentUser(signal: AbortSignal): Promise<User | null> {
  try {
    return await (await authRequest('/me', { signal })).json();
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const response = await authRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { user }: { user: User } = await response.json();
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await authRequest('/logout', { method: 'POST' });
  } catch (error) {
    if (!(error instanceof AuthError && error.status === 401)) throw error;
  }
}
