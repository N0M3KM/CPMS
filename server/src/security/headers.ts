import helmet from 'helmet';

// Security headers (CSP, nosniff, frame protection, referrer policy). No CORS middleware is
// installed on purpose: the API is same-origin only.
export const securityHeaders = () => helmet();
