import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { User } from './auth-api';
import { NewMilestoneForm } from './NewMilestoneForm';

const statusLabels = {
  NOT_SUBMITTED: 'Not submitted',
  SUBMITTED: 'Submitted',
  REVIEWED: 'Reviewed',
  OVERDUE: 'Overdue',
};

type MilestoneLink = { id: string; title: string; dueAt: string };
type MilestoneSummary = MilestoneLink & { status: keyof typeof statusLabels };
type Person = { id: string; name: string };
type TeamSummary = {
  id: string;
  name: string;
  progress: { notSubmitted: number; submitted: number; reviewed: number; overdue: number };
  nextDue: MilestoneLink | null;
};
type Team = {
  id: string;
  name: string;
  supervisor: Person;
  members: Person[];
  milestones: MilestoneSummary[];
};
type Milestone = MilestoneSummary & {
  teamId: string;
  description: string;
  submission: {
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

function DataView<T>({ path, children }: { path: string; children: (data: T, reload: () => void) => ReactNode }) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api${path}`, { signal: controller.signal });
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ status: 'error', message: 'This page is unavailable.' });
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        const data: T = await response.json();
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error', message: 'Could not load this view.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, path]);

  function reload() {
    setState({ status: 'loading' });
    setAttempt(previous => previous + 1);
  }

  if (state.status === 'loading') return <p role="status">Loading…</p>;
  if (state.status === 'ready') return children(state.data, reload);
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

export function MilestoneView() {
  const { milestoneId = '' } = useParams();
  return (
    <DataView<Milestone> key={milestoneId} path={`/milestones/${encodeURIComponent(milestoneId)}`}>
      {milestone => (
        <section aria-labelledby="milestone-name">
          <Link to={`/teams/${milestone.teamId}`}>Back to team</Link>
          <h2 id="milestone-name">{milestone.title}</h2>
          <p>Due <DateTime value={milestone.dueAt} />{' '}
            <span className="status-badge">{statusLabels[milestone.status]}</span>
          </p>
          {milestone.description && <p className="view-description">{milestone.description}</p>}
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
                </>
              ) : <p>No feedback yet.</p>}
            </>
          ) : <p>No submission yet.</p>}
        </section>
      )}
    </DataView>
  );
}
