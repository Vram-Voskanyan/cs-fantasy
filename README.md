# cs-vv-fantasy

Fantasy game for professional CS2 tournaments. Next.js on Cloudflare Workers.

- Production: https://cs-vv-fantasy.vram-arm.workers.dev
- Staging: https://cs-vv-fantasy-staging.vram-arm.workers.dev
- Plan: [docs/PLAN.md](docs/PLAN.md) · Design: [docs/DESIGN.md](docs/DESIGN.md) · Cloudflare: [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)

## Repository

```
apps/web        Next.js app (OpenNext on Workers): pages, auth, API
apps/worker     Background Worker: data ingest (cron) and scoring (queue)
packages/db     Drizzle schema and D1 migrations, shared by both apps
tests/          Repository checks (for example, strings files)
docs/           Plan, design system, Cloudflare setup, decisions
```

## Requirements

- Node.js 22 or newer, npm
- For deploys from your machine: `npx wrangler login`

## Local setup

```bash
npm install

# Local secrets (git-ignored). Ask a teammate or create your own:
cat > apps/web/.dev.vars <<EOF
NEXTJS_ENV=development
APP_ENV=development
APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
EOF
printf 'APP_ENV=development\nCITO_API_KEY=<your key>\nSYNC_TOKEN=%s\n' "$(openssl rand -hex 24)" > apps/worker/.dev.vars

npm run db:migrate:local   # creates the local D1 database
```

## Run locally

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with hot reload and local Cloudflare bindings (D1, KV, R2). Port 3000, or the next free port. |
| `npm run preview` | Builds the real Worker bundle and runs it in the local Workers runtime on http://localhost:8787. Use this to check behavior before a deploy. |
| `npm run dev:worker` | Background worker on http://localhost:8788, sharing the web app's local database. Load tournaments with `curl -X POST -H "Authorization: Bearer <SYNC_TOKEN from apps/worker/.dev.vars>" http://localhost:8788/sync/events` (uses 1 Cito call; the free plan has 500 per month). |

Without an email provider, verification and password reset links are printed in the dev server log.

## Checks

```bash
npm run check   # lint + typecheck + tests
```

## Database changes

1. Edit `packages/db/src/schema.ts`.
2. `npm run db:generate` creates a new SQL file in `packages/db/migrations/`.
3. `npm run db:migrate:local` applies it locally. Staging and production get it on deploy.

## Deploy

| Target | How |
|---|---|
| Staging | Automatic on every push to `main` (GitHub Actions), once the `CLOUDFLARE_API_TOKEN` secret is set. From your machine: `npm run deploy:staging`. |
| Production | GitHub → Actions → "Deploy production" → Run workflow. From your machine: `npm run deploy:production`. |

Both commands apply D1 migrations first, then deploy the web app and the background worker. Check a deploy with `curl <url>/api/health`.

## Rules

See [CLAUDE.md](CLAUDE.md): no hard-coded game numbers, all user-facing text in `apps/web/i18n/strings_en.json`, design tokens only, push to `main`.
