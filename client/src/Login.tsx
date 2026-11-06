import { useRef, useState, type FormEvent } from 'react';
import { AuthError, signIn, type User } from './auth-api';

export function Login({ onSignIn }: { onSignIn: (user: User) => void }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [requestError, setRequestError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailRef.current;
    const password = passwordRef.current;
    if (!email || !password || pending) return;

    const emailError = email.validity.valid ? undefined : 'Enter a valid email address.';
    const passwordError = password.validity.valid ? undefined : 'Enter your password.';
    setFieldErrors({ email: emailError, password: passwordError });
    setRequestError('');
    if (emailError || passwordError) {
      (emailError ? email : password).focus();
      return;
    }

    setPending(true);
    try {
      onSignIn(await signIn(email.value, password.value));
    } catch (error) {
      if (error instanceof AuthError && error.status === 401) {
        setRequestError('Email or password is incorrect.');
      } else if (error instanceof AuthError && error.status === 429) {
        setRequestError('Too many attempts. Please wait and try again.');
      } else if (error instanceof AuthError && error.status === 400) {
        setRequestError('Check your email and password and try again.');
      } else {
        setRequestError('Sign-in is temporarily unavailable. Try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>Sign in</h1>
      <p>Use your course account to access your CPMS workspace.</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">Email</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          readOnly={pending}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
        {fieldErrors.email && <p id="email-error" className="error" role="alert">{fieldErrors.email}</p>}
        <label htmlFor="password">Password</label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          readOnly={pending}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && <p id="password-error" className="error" role="alert">{fieldErrors.password}</p>}
        {requestError && <p className="error" role="alert">{requestError}</p>}
        <button disabled={pending} type="submit">Sign in</button>
        {pending && <p role="status">Signing in…</p>}
      </form>
    </>
  );
}
