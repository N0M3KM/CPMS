"""Public deployment checks for CPMS. Credentials and session cookies are never printed.

Called by .github/workflows/deploy.yml after a deployment (and by CI against the local container):
    python3 deploy/smoke_test.py SERVICE_URL

Checks, in order. Each public check is retried up to 5 times, 3 seconds apart, so a Cloud Run
cold start does not fail the run.
  1. GET /api/health      -> {"status": "ok"}
  2. GET /api/ready       -> {"status": "ready"}     (proves the database answers)
  3. GET /                -> the built client page (<div id="root">)
  4. GET /api/auth/me     -> 401 without a session  (proves the auth layer is live)
     GET /api/version     -> the commit; checked only when EXPECTED_COMMIT is set (R-08)
  5. OPTIONAL login check, only when BOTH env vars SMOKE_EMAIL and SMOKE_PASSWORD are set:
     log in, read /api/auth/me, list /api/teams (non-empty: migration and seed worked), log out,
     confirm /api/auth/me is 401 again. The session is always logged out, even if a check fails.
     Use a seeded student account, not a supervisor.

Only the Python standard library is used. Offline tests: deploy/tests/test_smoke.py
The session cookie is read from Set-Cookie and sent back by hand, so the check also works on
http://localhost, where Python's cookie jar would refuse a Secure cookie.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


def request(base, path, method='GET', data=None, cookie=None):
    """Returns (status, headers, body). HTTP error statuses are returned, not raised."""
    headers = {'Origin': base}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if cookie:
        headers['Cookie'] = cookie
    req = urllib.request.Request(base + path, method=method, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


def session_cookie(headers):
    raw = headers.get('Set-Cookie') or ''
    return raw.split(';', 1)[0] if raw.startswith('cpms_session=') else None


def public_checks(base):
    checks = (
        ('/api/health', 200, lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', 200, lambda b: json.loads(b).get('status') == 'ready'),
        ('/', 200, lambda b: b'<div id="root">' in b),
        ('/api/auth/me', 401, lambda b: json.loads(b).get('error', {}).get('code') == 'UNAUTHENTICATED'),
    )
    expected_commit = os.getenv('EXPECTED_COMMIT')
    if expected_commit:
        checks += (('/api/version', 200, lambda b: json.loads(b).get('commit') == expected_commit),)
    for path, expected_status, predicate in checks:
        for attempt in range(5):
            try:
                status, _headers, body = request(base, path)
                if status != expected_status or not predicate(body):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)


def login_check(base, email, password):
    cookie = None
    try:
        status, headers, body = request(base, '/api/auth/login', 'POST', {'email': email, 'password': password})
        cookie = session_cookie(headers)
        if status != 200 or not cookie or json.loads(body).get('user', {}).get('email') != email:
            raise ValueError('login')
        status, _headers, body = request(base, '/api/auth/me', cookie=cookie)
        if status != 200 or json.loads(body).get('email') != email:
            raise ValueError('me')
        status, _headers, body = request(base, '/api/teams', cookie=cookie)
        if status != 200 or not json.loads(body).get('teams'):
            raise ValueError('teams')
        print('PASS login, current user and team list')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, AttributeError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed.
        if cookie:
            request(base, '/api/auth/logout', 'POST', {}, cookie=cookie)
            status, _headers, _body = request(base, '/api/auth/me', cookie=cookie)
            print('PASS logout' if status == 401 else 'WARN session still valid after logout')


def check(base):
    public_checks(base)
    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    login_check(base, email, password)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
