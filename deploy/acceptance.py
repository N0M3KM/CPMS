"""Acceptance run for Lab 5 Issue "First deployment to Cloud Run" (R-03, C-04).

Drives the main Theme 6 workflow against a running CPMS and prints one line per check:
    python3 deploy/acceptance.py SERVICE_URL

Passwords come from the environment and are never printed (read them from Secret Manager):
    ACCEPT_SUPERVISOR_PASSWORD   password of supervisor1@example.test and supervisor2@example.test
    ACCEPT_STUDENT_PASSWORD      password of student.a1@example.test
Optional: EXPECTED_COMMIT        also checks GET /api/version

What it checks (AC-1 to AC-3):
  1  health, readiness, client page, 401 without a session (and the commit if given)
  2  main workflow: supervisor creates a milestone, a team member submits, reloads and sees it,
     the supervisor records feedback, the member sees it
  3  rule rejection: second submission 409, too-short feedback 400, second feedback 409
  4  forbidden: no cookie 401, student creating a milestone 403, student reading another team 404
     (same answer as a nonexistent ID), supervisor of another team 404
  5  every error body is the safe envelope: no stack, SQL or framework text

It creates one milestone, one submission and one feedback record named "Cloud Run acceptance <time>"
on Team A. Run it once per deployment. Sessions are always logged out. Only the standard library.
"""
import json
import os
import sys
import time
import urllib.error
from datetime import datetime, timedelta, timezone

from smoke_test import public_checks, request, session_cookie

SUPERVISOR_1 = 'supervisor1@example.test'
SUPERVISOR_2 = 'supervisor2@example.test'
STUDENT_A1 = 'student.a1@example.test'
ZERO_UUID = '00000000-0000-4000-8000-000000000000'
LEAK_MARKERS = ('prisma', 'node_modules', 'select ', 'stack', ' at ', 'postgres')

failures = []


def record(ok, name, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' (' + detail + ')' if detail else ''))
    if not ok:
        failures.append(name)


def call(base, path, method='GET', data=None, cookie=None):
    """Returns (status, parsed JSON or None, raw text)."""
    status, _headers, body = request(base, path, method, data, cookie)
    text = body.decode('utf-8', 'replace')
    try:
        return status, json.loads(text), text
    except ValueError:
        return status, None, text


def expect(name, result, status):
    got, payload, text = result
    ok = got == status
    if status >= 400:
        code = (payload or {}).get('error', {}).get('code') if isinstance(payload, dict) else None
        leaked = [m for m in LEAK_MARKERS if m in text.lower()]
        record(ok and not leaked and code is not None, name,
               'expected %d, got %d, code %s%s' % (status, got, code, ', LEAK ' + ','.join(leaked) if leaked else ''))
    else:
        record(ok, name, 'expected %d, got %d' % (status, got))
    return payload


def login(base, email, password):
    status, headers, body = request(base, '/api/auth/login', 'POST', {'email': email, 'password': password})
    cookie = session_cookie(headers)
    record(status == 200 and cookie is not None, 'login ' + email, 'status %d' % status)
    if not cookie:
        raise RuntimeError('Cannot continue without a session for ' + email)
    return cookie


def run(base, supervisor_password, student_password):
    cookies = []
    try:
        record(True, 'target ' + base)
        public_checks(base)

        sup = login(base, SUPERVISOR_1, supervisor_password)
        cookies.append(sup)
        teams = expect('supervisor 1 lists teams', call(base, '/api/teams', cookie=sup), 200)['teams']
        by_name = {team['name']: team['id'] for team in teams}
        record({'Team A', 'Team B'} <= set(by_name) and 'Team C' not in by_name, 'supervisor 1 sees Teams A and B only')
        team_a, team_b = by_name['Team A'], by_name['Team B']

        label = 'Cloud Run acceptance ' + datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        due = (datetime.now(timezone.utc) + timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
        created = expect('supervisor creates milestone on Team A', call(
            base, '/api/teams/%s/milestones' % team_a, 'POST',
            {'title': label, 'description': 'Created by deploy/acceptance.py', 'dueAt': due}, sup), 201)
        milestone = created['id']

        stu = login(base, STUDENT_A1, student_password)
        cookies.append(stu)
        own = expect('student lists teams', call(base, '/api/teams', cookie=stu), 200)['teams']
        record([t['name'] for t in own] == ['Team A'], 'student sees Team A only')

        work = {'title': 'Acceptance submission', 'link': 'https://example.com/acceptance',
                'description': 'Submission created by the Cloud Run acceptance run.'}
        submission = expect('member submits work', call(base, '/api/milestones/%s/submission' % milestone, 'POST', work, stu), 201)
        detail = expect('member reloads milestone', call(base, '/api/milestones/%s' % milestone, cookie=stu), 200)
        record(detail['status'] == 'SUBMITTED' and detail['submission']['title'] == work['title'],
               'saved submission is persisted, status SUBMITTED')

        expect('RULE second submission rejected', call(
            base, '/api/milestones/%s/submission' % milestone, 'POST', work, stu), 409)
        expect('RULE too-short feedback rejected', call(
            base, '/api/submissions/%s/feedback' % submission['id'], 'POST', {'comment': 'short'}, sup), 400)
        expect('supervisor records feedback', call(
            base, '/api/submissions/%s/feedback' % submission['id'], 'POST',
            {'comment': 'Looks good. Please add more detail next time.'}, sup), 201)
        expect('RULE second feedback rejected', call(
            base, '/api/submissions/%s/feedback' % submission['id'], 'POST',
            {'comment': 'A second comment must be refused.'}, sup), 409)
        final = expect('member reads feedback', call(base, '/api/milestones/%s' % milestone, cookie=stu), 200)
        record(final['status'] == 'REVIEWED' and final['submission']['feedback'] is not None,
               'status REVIEWED and feedback visible to the team')

        expect('FORBIDDEN no session: 401', call(base, '/api/teams'), 401)
        expect('FORBIDDEN student creates milestone: 403', call(
            base, '/api/teams/%s/milestones' % team_a, 'POST', {'title': 'Not allowed here', 'dueAt': due}, stu), 403)
        other_team = call(base, '/api/teams/%s' % team_b, cookie=stu)
        missing_team = call(base, '/api/teams/%s' % ZERO_UUID, cookie=stu)
        expect('FORBIDDEN student reads Team B: 404', other_team, 404)
        record(other_team[0] == missing_team[0] and other_team[1] == missing_team[1],
               'FORBIDDEN other-team answer equals nonexistent-ID answer')

        sup2 = login(base, SUPERVISOR_2, supervisor_password)
        cookies.append(sup2)
        expect('FORBIDDEN supervisor 2 creates milestone on Team A: 404', call(
            base, '/api/teams/%s/milestones' % team_a, 'POST', {'title': 'Not allowed here', 'dueAt': due}, sup2), 404)
        expect('FORBIDDEN supervisor 2 reads Team A milestone: 404', call(
            base, '/api/milestones/%s' % milestone, cookie=sup2), 404)
    finally:
        for cookie in cookies:
            request(base, '/api/auth/logout', 'POST', {}, cookie=cookie)
        for cookie in cookies:
            status, _headers, _body = request(base, '/api/auth/me', cookie=cookie)
            record(status == 401, 'session revoked after logout')


def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/acceptance.py SERVICE_URL')
    supervisor_password = os.getenv('ACCEPT_SUPERVISOR_PASSWORD')
    student_password = os.getenv('ACCEPT_STUDENT_PASSWORD')
    if not supervisor_password or not student_password:
        sys.exit('Set ACCEPT_SUPERVISOR_PASSWORD and ACCEPT_STUDENT_PASSWORD (never put them on the command line).')
    started = time.time()
    try:
        run(sys.argv[1].rstrip('/'), supervisor_password, student_password)
    except (RuntimeError, urllib.error.URLError, KeyError, TypeError) as error:
        record(False, 'acceptance run aborted', type(error).__name__)
    print('%s: %d check(s) failed in %.1fs' % ('FAILED' if failures else 'OK', len(failures), time.time() - started))
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
