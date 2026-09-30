# Roadmap

## Done

**Core**
- pnpm monorepo with shared Zod schemas (`@rpa/types`)
- Postgres + Redis via Docker Compose, with schema in `infra/init.sql`
- Fastify API: recipe CRUD, sync and async executions, API-key auth, health check
- Recipe secrets encrypted with AES-256-GCM, never returned by the API
- BullMQ queue and a Playwright runner that keeps the browser open between jobs
- Session manager: checks whether the session is still valid and re-runs the login steps when needed
- Step types: `navigate`, `click`, `hover`, `fill`, `select`, `wait`, `extract`, `screenshot`, `download`, `upload`, `pbi_export`

**Interface**
- Chrome extension (MV3) that records clicks and inputs and exports them as a recipe
- Dashboard calls go through an authenticated Next.js proxy route, so the API key stays on the server
- Next.js dashboard with login: recipe editor, execution history, Excel export of results, and a page that generates the API call for a recipe

**Production use**
- Dockerfiles for backend, runner and dashboard, plus a production compose file behind Caddy
- Used as the extraction layer for carrier portals in the [logistics-sync](https://github.com/leopp18/logistics-sync) pipeline

## Next

- Automated tests (step executor with a local test page, API routes)
- A browser context per job, so `WORKER_CONCURRENCY > 1` doesn't share one page
- Screenshot and HTML snapshot on failure, stored with the execution
- Webhook callback when an async execution finishes
- Analytics page (success rate and duration per recipe); today it is a placeholder
