import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { currentUser, signOut, type User } from './auth-api';
import { Login } from './Login';
import { MilestoneView, ScopedHome, TeamView } from './ScopedViews';
import './styles.css';

function homePath(user: User): string {
  return user.role === 'STUDENT' ? '/student' : '/supervisor';
}

function SignedInView({ user, onSignOut, title, children }: {
  user: User;
  onSignOut: () => void;
  title: string;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => heading.current?.focus(), [title]);

  async function logout() {
    setPending(true);
    setError('');
    try {
      await signOut();
      onSignOut();
    } catch {
      setError('Sign-out is temporarily unavailable. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>Signed in as {user.name}.</p>
      <nav className="account-actions" aria-label="Account">
        <Link to={homePath(user)}>Home</Link>
        <button type="button" disabled={pending} onClick={logout}>{pending ? 'Signing out…' : 'Sign out'}</button>
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      {children}
    </>
  );
}

type SessionState = { status: 'loading' | 'error' } | { status: 'ready'; user: User | null };

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [check, setCheck] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    currentUser(controller.signal).then(
      user => {
        if (!controller.signal.aborted) setSession({ status: 'ready', user });
      },
      () => {
        if (!controller.signal.aborted) setSession({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [check]);

  const setUser = (user: User | null) => setSession({ status: 'ready', user });
  const user = session.status === 'ready' ? session.user : null;
  const destination = user ? homePath(user) : '/login';

  function renderHome(path: string) {
    if (!user || destination !== path) return <Navigate replace to={destination} />;
    return renderSignedIn(user.role === 'STUDENT' ? 'Student home' : 'Supervisor home', <ScopedHome role={user.role} />);
  }

  function renderSignedIn(title: string, view: ReactNode) {
    if (!user) return <Navigate replace to="/login" />;
    return <SignedInView user={user} onSignOut={() => setUser(null)} title={title}>{view}</SignedInView>;
  }

  return (
    <main className="shell">
      <section className={user ? 'card workspace-card' : 'card'} aria-label="CPMS">
        <p className="brand">CPMS</p>
        {session.status === 'loading' && <p role="status">Checking your session…</p>}
        {session.status === 'error' && (
          <>
            <h1>Unable to check your session</h1>
            <p role="alert">The service is temporarily unavailable.</p>
            <button type="button" onClick={() => {
              setSession({ status: 'loading' });
              setCheck(previous => previous + 1);
            }}>Try again</button>
          </>
        )}
        {session.status === 'ready' && (
          <Routes>
            <Route path="/login" element={user ? <Navigate replace to={destination} /> : <Login onSignIn={setUser} />} />
            <Route path="/student" element={renderHome('/student')} />
            <Route path="/supervisor" element={renderHome('/supervisor')} />
            <Route path="/teams/:teamId" element={renderSignedIn(
              'Team detail', <TeamView canCreate={user?.role === 'SUPERVISOR'} />,
            )} />
            <Route path="/milestones/:milestoneId" element={renderSignedIn('Milestone detail', <MilestoneView canSubmit={user?.role === 'STUDENT'} />)} />
            <Route path="*" element={<Navigate replace to={destination} />} />
          </Routes>
        )}
      </section>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<BrowserRouter><App /></BrowserRouter>);
