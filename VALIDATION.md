# Validation results

Validated on 19 July 2026:

- `npm ci`: passed
- `npm run typecheck`: passed
- `next build`: passed
- Generated pages: 14/14
- `/overview`: HTTP 200 in production mode
- `/login`: HTTP 200 in production mode
- `/api/reports/send` without authentication: HTTP 401
- ZIP excludes `.env.local`, `node_modules` and `.next`
