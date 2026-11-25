import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { User } from './auth-api';
import { FeedbackForm } from './FeedbackForm';
import { GradeForm } from './GradeForm';
import { ManageMilestone } from './ManageMilestone';
import { NewMilestoneForm } from './NewMilestoneForm';
import { ReviseWorkForm } from './ReviseWorkForm';
import { SubmitWorkForm } from './SubmitWorkForm';

const statusLabels = {
  NOT_SUBMITTED: 'Not submitted',
  SUBMITTED: 'Submitted',
  REVIEWED: 'Reviewed',
  OVERDUE: 'Overdue',
  CLOSED: 'Closed',
};

type MilestoneLink = { id: string; title: string; dueAt: string };
type MilestoneSummary = MilestoneLink & { status: keyof typeof statusLabels };
type Person = { id: string; name: string };
type TeamSummary = {
  id: string;
  name: string;
  progress: { notSubmitted: number; submitted: number; reviewed: number; overdue: number; closed: number };
  nextDue: MilestoneLink | null;
};
type Team = {
  id: string;
  name: string;
  supervisor: Person;
  members: Person[];
  milestones: MilestoneSummary[];
};
type Revision = {
  revisionNo: number;
  id: string;
  title: string;
  description: string;
  link: string;
  submittedAt: string;
  feedback: { comment: string; createdAt: string } | null;
  grade: { score: number; createdAt: string; supervisor: Person } | null;
};
const MAX_REVISIONS = 5;
type Milestone = MilestoneSummary & {
  teamId: string;
  description: string;
  closedAt: string | null;
  revisions: Revision[];
  submission: {
    id: string;
    title: string;
    description: string;
    link: string;
    submittedAt: string;
    feedback: { comment: string; createdAt: string } | null;
  } | null;
};

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

// The app provides this so a view can tell it the server no longer knows the session (401).
export const SessionEndedContext = createContext<() => void>(() => undefined);

function DataView<T>({ path, children, failureMessage = 'Could not load this view.' }: {
  path: string;
  children: (data: T, reload: () => void, refresh: () => void) => ReactNode;
  failureMessage?: string;
}) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const onSessionEnded = useContext(SessionEndedContext);
  const sessionEnded = useRef(onSessionEnded);
  sessionEnded.current = onSessionEnded;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api${path}`, { signal: controller.signal });
        if (response.status === 401) {
          // Retrying cannot help: send the user to Sign in instead of showing a dead-end error.
          if (!controller.signal.aborted) sessionEnded.current();
          return;
        }
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ status: 'error', message: 'This page is unavailable.' });
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        const data: T = await response.json();
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error', message: failureMessage });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, path, failureMessage]);

  function reload() {
    setState({ status: 'loading' });
    setAttempt(previous => previous + 1);
  }

  if (state.status === 'loading') return <p role="status">Loading…</p>;
  // refresh fetches again but keeps the current view on screen, so forms with unsaved text are not unmounted.
  function refresh() {
    setAttempt(previous => previous + 1);
  }

  if (state.status === 'ready') return children(state.data, reload, refresh);
  return (
    <>
      <p className="error" role="alert">{state.message}</p>
      <button type="button" onClick={reload}>Try again</button>
    </>
  );
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function DateTime({ value }: { value: string }) {
  return <time dateTime={value}>{dateTime.format(new Date(value))}</time>;
}

function MilestoneItem({ milestone }: { milestone: MilestoneLink }) {
  return (
    <>
      <Link to={`/milestones/${milestone.id}`}>{milestone.title}</Link>
      {' · Due '}<DateTime value={milestone.dueAt} />
    </>
  );
}

type SearchResult = { items: MilestoneSummary[]; total: number; page: number; limit: number };

export function SearchView() {
  const [filters, setFilters] = useState({ title: '', status: '', page: 1 });
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.title) params.set('q', filters.title);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({ title: String(form.get('title') ?? '').trim(), status: String(form.get('status') ?? ''), page: 1 });
  }

  return (
    <section aria-label="Milestone search">
      <p>Search covers up to 1,000 matching milestones you can access.</p>
      <form className="search-filters" onSubmit={search}>
        <div>
          <label htmlFor="search-title">Milestone title</label>
          <input id="search-title" name="title" type="search" maxLength={100} />
        </div>
        <div>
          <label htmlFor="search-status">Status</label>
          <select id="search-status" name="status">
            <option value="">Any status</option>
            {Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <button type="submit">Search</button>
      </form>
      <DataView<SearchResult> key={query} path={`/search?${query}`} failureMessage="Could not load search results.">
        {({ items, total, page, limit }) => {
          const lastPage = Math.max(1, Math.ceil(total / limit));
          return (
            <>
              <p role="status">{total} {total === 1 ? 'result' : 'results'} · Page {page} of {lastPage}</p>
              {items.length === 0 ? <p>No milestones match your search.</p> : (
                <ul className="view-list">
                  {items.map(item => (
                    <li key={item.id}>
                      <MilestoneItem milestone={item} />{' '}
                      <span className="status-badge">{statusLabels[item.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
              {lastPage > 1 && (
                <nav className="account-actions" aria-label="Search pages">
                  <button type="button" disabled={page <= 1} onClick={() => setFilters({ ...filters, page: page - 1 })}>Previous</button>
                  <button type="button" disabled={page >= lastPage} onClick={() => setFilters({ ...filters, page: page + 1 })}>Next</button>
                </nav>
              )}
            </>
          );
        }}
      </DataView>
    </section>
  );
}

export function ScopedHome({ role }: { role: User['role'] }) {
  return (
    <DataView<{ teams: TeamSummary[] }> path="/teams">
      {({ teams }) => {
        if (role === 'STUDENT') {
          return teams[0] ? <TeamData teamId={teams[0].id} /> : <p>You are not assigned to a team.</p>;
        }
        return (
          <section aria-labelledby="assigned-teams">
            <h2 id="assigned-teams">Assigned teams</h2>
            {teams.length === 0 ? <p>You have no assigned teams.</p> : (
              <ul className="view-list">
                {teams.map(team => (
                  <li key={team.id}>
                    <h3><Link to={`/teams/${team.id}`}>{team.name}</Link></h3>
                    <ul className="progress-list" aria-label={`${team.name} milestone counts`}>
                      <li>{statusLabels.NOT_SUBMITTED}: {team.progress.notSubmitted}</li>
                      <li>{statusLabels.SUBMITTED}: {team.progress.submitted}</li>
                      <li>{statusLabels.REVIEWED}: {team.progress.reviewed}</li>
                      <li>{statusLabels.OVERDUE}: {team.progress.overdue}</li>
                      <li>{statusLabels.CLOSED}: {team.progress.closed}</li>
                    </ul>
                    <p>Next due: {team.nextDue ? <MilestoneItem milestone={team.nextDue} /> : 'No upcoming work.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      }}
    </DataView>
  );
}

function TeamData({ teamId, canCreate = false }: { teamId: string; canCreate?: boolean }) {
  const [created, setCreated] = useState(false);
  return (
    <>
      {canCreate && <div role="status">{created ? 'Milestone created.' : ''}</div>}
      <DataView<Team> key={teamId} path={`/teams/${encodeURIComponent(teamId)}`}>
        {(team, reload) => (
          <section aria-labelledby="team-name">
            <h2 id="team-name">{team.name}</h2>
            <p>Supervisor: {team.supervisor.name}</p>
            <h3>Members</h3>
            {team.members.length === 0 ? <p>No members yet.</p> : (
              <ul>{team.members.map(member => <li key={member.id}>{member.name}</li>)}</ul>
            )}
            <h3>Milestones</h3>
            {team.milestones.length === 0 ? <p>No milestones yet.</p> : (
              <ul className="view-list">
                {team.milestones.map(milestone => (
                  <li key={milestone.id}>
                    <MilestoneItem milestone={milestone} />
                    {' '}<span className="status-badge">{statusLabels[milestone.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {canCreate && <NewMilestoneForm teamId={team.id} onCreated={() => {
              setCreated(true);
              reload();
            }} />}
          </section>
        )}
      </DataView>
    </>
  );
}

export function TeamView({ canCreate }: { canCreate: boolean }) {
  const { teamId = '' } = useParams();
  return <TeamData key={teamId} teamId={teamId} canCreate={canCreate} />;
}

function SubmissionLink({ value }: { value: string }) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return <a href={url.href} rel="noopener noreferrer">{value}</a>;
    }
  } catch {
    // Legacy or invalid URLs are displayed as text.
  }
  return <span>{value}</span>;
}

function RevisionHistory({ revisions }: { revisions: Revision[] }) {
  return (
    <section aria-labelledby="version-history">
      <h3 id="version-history">Version history</h3>
      <ol className="view-list">
        {revisions.map(revision => (
          <li key={revision.id}>
            <p><strong>Version {revision.revisionNo}</strong>: {revision.title}</p>
            <p>Sent <DateTime value={revision.submittedAt} /></p>
            <p className="view-description">{revision.description}</p>
            <p><SubmissionLink value={revision.link} /></p>
            <p>{revision.feedback ? `Feedback: ${revision.feedback.comment}` : 'No feedback on this version.'}</p>
            {revision.grade && <p>Grade: {revision.grade.score} by {revision.grade.supervisor.name}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MilestoneView({ canSubmit = false, canReview = false }: { canSubmit?: boolean; canReview?: boolean }) {
  const { milestoneId = '' } = useParams();
  return (
    <DataView<Milestone> key={milestoneId} path={`/milestones/${encodeURIComponent(milestoneId)}`}>
      {(milestone, reload, refresh) => {
        // The current revision is the last item of revisions[]; its grade (if any) sits beside its feedback.
        const currentGrade = milestone.revisions.at(-1)?.grade ?? null;
        return (
        <section aria-labelledby="milestone-name">
          <Link to={`/teams/${milestone.teamId}`}>Back to team</Link>
          <h2 id="milestone-name">{milestone.title}</h2>
          <p>Due <DateTime value={milestone.dueAt} />{' '}
            <span className="status-badge">{statusLabels[milestone.status]}</span>
          </p>
          {milestone.closedAt && (
            <p>
              {milestone.status !== 'CLOSED' && <><span className="status-badge">Closed</span>{' '}</>}
              Closed on <DateTime value={milestone.closedAt} />
            </p>
          )}
          {milestone.description && <p className="view-description">{milestone.description}</p>}
          {/* canReview is true only for the supervisor role; the server still checks the team on every call. */}
          {canReview && !milestone.closedAt && <ManageMilestone milestone={milestone} onChanged={reload} />}
          <h3>Submission</h3>
          {milestone.submission ? (
            <>
              <h4>{milestone.submission.title}</h4>
              <p className="view-description">{milestone.submission.description}</p>
              <p><SubmissionLink value={milestone.submission.link} /></p>
              <p>Submitted <DateTime value={milestone.submission.submittedAt} /></p>
              <h3>Feedback</h3>
              {milestone.submission.feedback ? (
                <>
                  <p className="view-description">{milestone.submission.feedback.comment}</p>
                  <p>Recorded <DateTime value={milestone.submission.feedback.createdAt} /></p>
                  {currentGrade ? (
                    <p>Grade: {currentGrade.score} by {currentGrade.supervisor.name} (<DateTime value={currentGrade.createdAt} />)</p>
                  ) : canReview ? <GradeForm submissionId={milestone.submission.id} onSaved={reload} /> : null}
                </>
              ) : canReview ? <FeedbackForm submissionId={milestone.submission.id} onSaved={reload} onStale={refresh} />
                : <p>No feedback yet.</p>}
              {milestone.revisions.length > 1 && <RevisionHistory revisions={milestone.revisions} />}
              {canSubmit && !milestone.closedAt && Date.now() <= Date.parse(milestone.dueAt)
                && milestone.revisions.length < MAX_REVISIONS
                && <ReviseWorkForm milestoneId={milestone.id} onRevised={reload} />}
            </>
          ) : milestone.status === 'OVERDUE' ? <p>The deadline has passed and no work was submitted.</p>
            : milestone.closedAt ? <p>This milestone is closed. No work was submitted.</p>
            : canSubmit ? <SubmitWorkForm milestoneId={milestone.id} onSubmitted={reload} />
            : <p>No submission yet.</p>}
        </section>
        );
      }}
    </DataView>
  );
}
