"""Persistence check for Lab 5 (R-04, C-05): create one synthetic record, then find it again later.

    python3 deploy/persistence_check.py create SERVICE_URL
    python3 deploy/persistence_check.py verify SERVICE_URL RECORD_ID

`create` signs in as supervisor1@example.test, creates one milestone on Team A through the API, and
prints its identifier, title and the commit the service reports at that moment.
`verify` signs in again (a new session) and reads the same record back. Run it after a restart, a
redeployment and a rollback; it prints the record and the commit the service reports now.
Exit status 0 means the record was found with the expected title.

The password comes from the environment and is never printed:
    ACCEPT_SUPERVISOR_PASSWORD   (Secret Manager: cpms-seed-supervisor-password)
Only the standard library is used. The record is synthetic and stays in the demo database.
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

from smoke_test import request, session_cookie

SUPERVISOR = 'supervisor1@example.test'
TITLE_PREFIX = 'Persistence check '


def send(base, path, method='GET', data=None, cookie=None):
    """One request; a network failure ends the run with a short message, not a traceback."""
    try:
        return request(base, path, method, data, cookie)
    except OSError as error:
        sys.exit('FAIL cannot reach %s%s (%s)' % (base, path, type(error).__name__))


def call(base, path, method='GET', data=None, cookie=None):
    status, _headers, body = send(base, path, method, data, cookie)
    try:
        return status, json.loads(body.decode('utf-8', 'replace'))
    except ValueError:
        return status, None


def reported_commit(base):
    for attempt in range(5):  # a cold start can take a few seconds
        try:
            status, payload = call(base, '/api/version')
            if status == 200 and payload:
                return payload.get('commit', 'unknown')
        except OSError:
            pass
        time.sleep(3)
    sys.exit('FAIL service did not answer /api/version')


def login(base, password):
    status, headers, _body = send(base, '/api/auth/login', 'POST', {'email': SUPERVISOR, 'password': password})
    cookie = session_cookie(headers)
    if status != 200 or not cookie:
        sys.exit('FAIL sign-in as %s returned %d' % (SUPERVISOR, status))
    return cookie


def logout(base, cookie):
    send(base, '/api/auth/logout', 'POST', {}, cookie=cookie)


def create(base, password):
    cookie = login(base, password)
    try:
        status, teams = call(base, '/api/teams', cookie=cookie)
        team_a = next((t['id'] for t in (teams or {}).get('teams', []) if t['name'] == 'Team A'), None)
        if status != 200 or not team_a:
            sys.exit('FAIL could not find Team A (status %d)' % status)
        stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        due = (datetime.now(timezone.utc) + timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
        status, record = call(base, '/api/teams/%s/milestones' % team_a, 'POST',
                              {'title': TITLE_PREFIX + stamp, 'description': 'Synthetic record for the persistence check.',
                               'dueAt': due}, cookie)
        if status != 201 or not record:
            sys.exit('FAIL create returned %d' % status)
        print('CREATED id=%s title=%r commit=%s' % (record['id'], record['title'], reported_commit(base)))
    finally:
        logout(base, cookie)


def verify(base, password, record_id):
    cookie = login(base, password)
    try:
        status, record = call(base, '/api/milestones/%s' % record_id, cookie=cookie)
        found = status == 200 and bool(record) and record.get('title', '').startswith(TITLE_PREFIX)
        print('%s id=%s status=%d title=%r commit=%s' % (
            'FOUND' if found else 'MISSING', record_id, status, (record or {}).get('title'), reported_commit(base)))
        sys.exit(0 if found else 1)
    finally:
        logout(base, cookie)


def main():
    args = sys.argv[1:]
    usage = 'Usage: persistence_check.py create SERVICE_URL | verify SERVICE_URL RECORD_ID'
    if len(args) < 2 or args[0] not in ('create', 'verify') or (args[0] == 'verify') != (len(args) == 3):
        sys.exit(usage)
    password = os.getenv('ACCEPT_SUPERVISOR_PASSWORD')
    if not password:
        sys.exit('Set ACCEPT_SUPERVISOR_PASSWORD (never put it on the command line).')
    base = args[1].rstrip('/')
    if args[0] == 'create':
        create(base, password)
    else:
        verify(base, password, args[2])


if __name__ == '__main__':
    main()
