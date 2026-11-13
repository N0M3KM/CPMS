import helmet from 'helmet';

// Security headers (CSP, nosniff, frame protection, referrer policy). No CORS middleware is
// installed on purpose: the API is same-origin only.
// upgrade-insecure-requests is switched off for plain-http origins (local container runs on
// http://localhost) because browsers would otherwise rewrite same-origin asset requests to https.
export const securityHeaders = (options: { upgradeInsecureRequests?: boolean } = {}) => {
  const upgrade = options.upgradeInsecureRequests ?? true;
  return helmet({
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': upgrade ? [] : null } },
  });
};
