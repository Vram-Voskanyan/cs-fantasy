# cs-vv-fantasy

Fantasy game for professional CS2 tournaments. Next.js on Cloudflare Workers.

- Production: https://cs-vv-fantasy.vram-arm.workers.dev
- Staging: https://cs-vv-fantasy-staging.vram-arm.workers.dev
- Plan: [docs/PLAN.md](docs/PLAN.md) · Design: [docs/DESIGN.md](docs/DESIGN.md) · Cloudflare: [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)

## Repository

```
apps/web        Next.js app on Workers (OpenNext) plus background jobs (cron data sync, scoring queue)
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
printf 'CITO_API_KEY=<your key>\nSYNC_TOKEN=%s\n' "$(openssl rand -hex 24)" >> apps/web/.dev.vars

npm run db:migrate:local   # creates the local D1 database
```

## Run locally

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with hot reload and local Cloudflare bindings (D1, KV, R2). Port 3000, or the next free port. |
| `npm run preview` | Builds the real Worker bundle and runs it in the local Workers runtime on http://localhost:8787, with the cron handler enabled. Use this to check behavior before a deploy. |

Load tournaments locally (1 Cito call; the free plan has 500 per month): `curl -X POST -H "Authorization: Bearer <SYNC_TOKEN from apps/web/.dev.vars>" http://localhost:3000/api/internal/sync/events`. In `npm run preview`, you can also run the cron: `curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"`.

Without an email provider, password reset links are printed in the dev server log. Email verification is off for the MVP.

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
| Staging, then production | Automatic on every push to `main` (GitHub Actions), once the `CLOUDFLARE_API_TOKEN` secret is set. Production deploys only if staging is healthy. |
| From your machine | `npm run deploy:staging`, `npm run deploy:production` |

Both commands apply D1 migrations first, then deploy the Worker. Check a deploy with `curl <url>/api/health`.

## Rules

See [CLAUDE.md](CLAUDE.md): no hard-coded game numbers, all user-facing text in `apps/web/i18n/strings_en.json`, design tokens only, push to `main`.
