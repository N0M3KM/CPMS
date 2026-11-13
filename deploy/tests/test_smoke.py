"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs them too. They cover: the public checks pass and the optional login is skipped without
credentials; a database that is not ready fails even when HTTP answers; a missing client page
fails; a login that returns no session cookie fails; the session is logged out even if a later
check fails; setting only one of the two credentials is refused.
"""
import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)

COOKIE = 'cpms_session=test-session'
EMAIL = 'student.a1@example.test'


class Headers(dict):
    def get(self, key, default=None):
        return super().get(key, default)


def ok(body, status=200, headers=None):
    return status, Headers(headers or {}), body


class SmokeTests(unittest.TestCase):
    def respond(self, base, path, method='GET', data=None, cookie=None):
        if path == '/api/auth/me':
            if cookie == COOKIE and self.logged_in:
                return ok(json.dumps({'id': '1', 'email': EMAIL}).encode())
            return ok(b'{"error":{"code":"UNAUTHENTICATED","message":"Sign in to continue."}}', 401)
        table = {
            '/api/health': ok(b'{"status":"ok"}'),
            '/api/ready': ok(b'{"status":"ready"}'),
            '/api/version': ok(b'{"commit":"abc123"}'),
            '/': ok(b'<html><div id="root"></div></html>'),
            '/api/auth/login': ok(json.dumps({'user': {'email': EMAIL}}).encode(), headers={'Set-Cookie': COOKIE + '; Path=/; HttpOnly'}),
            '/api/teams': ok(b'{"teams":[{"id":"t"}]}'),
        }
        if path == '/api/auth/login':
            self.logged_in = True
        if path == '/api/auth/logout':
            self.logged_in = False
            return ok(b'{"status":"ok"}')
        return table[path]

    def setUp(self):
        self.logged_in = False

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.respond) as req:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 4)

    @patch.dict('os.environ', {'EXPECTED_COMMIT': 'abc123'}, clear=True)
    def test_expected_commit_is_checked_and_passes_when_it_matches(self):
        with patch.object(smoke, 'request', side_effect=self.respond) as req:
            smoke.check('https://demo.test')
        self.assertIn('/api/version', [c.args[1] for c in req.call_args_list])

    @patch.dict('os.environ', {'EXPECTED_COMMIT': 'def456'}, clear=True)
    def test_wrong_running_commit_fails(self):
        with patch.object(smoke, 'request', side_effect=self.respond), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/version'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, *args, **kwargs):
            return ok(b'{"status":"degraded"}') if path == '/api/ready' else self.respond(base, path, *args, **kwargs)
        with patch.object(smoke, 'request', side_effect=disconnected), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_client_page_fails(self):
        def no_page(base, path, *args, **kwargs):
            return ok(b'{"error":{"code":"NOT_FOUND"}}', 404) if path == '/' else self.respond(base, path, *args, **kwargs)
        with patch.object(smoke, 'request', side_effect=no_page), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'Smoke check failed: /'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_anonymous_me_must_be_401(self):
        def open_me(base, path, *args, **kwargs):
            return ok(b'{"id":"1"}') if path == '/api/auth/me' else self.respond(base, path, *args, **kwargs)
        with patch.object(smoke, 'request', side_effect=open_me), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/auth/me'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': EMAIL, 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_login_flow_passes_and_logs_out(self):
        with patch.object(smoke, 'request', side_effect=self.respond) as req:
            smoke.check('https://demo.test')
        paths = [c.args[1] for c in req.call_args_list]
        self.assertIn('/api/teams', paths)
        self.assertIn('/api/auth/logout', paths)
        self.assertFalse(self.logged_in)

    @patch.dict('os.environ', {'SMOKE_EMAIL': EMAIL, 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_login_without_session_cookie_fails(self):
        def no_cookie(base, path, *args, **kwargs):
            if path == '/api/auth/login':
                return ok(json.dumps({'user': {'email': EMAIL}}).encode())
            return self.respond(base, path, *args, **kwargs)
        with patch.object(smoke, 'request', side_effect=no_cookie):
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': EMAIL, 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_session_is_logged_out_even_if_teams_check_fails(self):
        def broken_teams(base, path, *args, **kwargs):
            return ok(b'{"teams":[]}') if path == '/api/teams' else self.respond(base, path, *args, **kwargs)
        with patch.object(smoke, 'request', side_effect=broken_teams) as req:
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
        self.assertIn('/api/auth/logout', [c.args[1] for c in req.call_args_list])

    @patch.dict('os.environ', {'SMOKE_EMAIL': EMAIL}, clear=True)
    def test_only_one_credential_is_refused(self):
        with patch.object(smoke, 'request', side_effect=self.respond):
            with self.assertRaisesRegex(RuntimeError, 'both'):
                smoke.check('https://demo.test')




if __name__ == '__main__':
    unittest.main()
