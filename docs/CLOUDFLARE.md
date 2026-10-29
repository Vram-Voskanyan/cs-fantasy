# cs-vv-fantasy: Cloudflare setup

Created on 2026-10-29 with `wrangler` 4.155.0. Resource IDs are not secrets; API keys and tokens never go in this file.

## Account

| | |
|---|---|
| Account | Vram.arm@gmail.com's Account |
| Account ID | `6c6825bf5f6bf3c1b9e8593cd6067a06` |
| `workers.dev` subdomain | `vram-arm` |
| App URL (production, after first deploy) | `https://cs-vv-fantasy.vram-arm.workers.dev` |
| App URL (staging, after first deploy) | `https://cs-vv-fantasy-staging.vram-arm.workers.dev` |

## Resources

All data resources are in Western Europe (`weur`).

| Type | Production | Staging | Binding name in code |
|---|---|---|---|
| D1 database | `cs-vv-fantasy-db` (`cf6db5c6-71a6-4297-b854-7c2f35b99a60`) | `cs-vv-fantasy-db-staging` (`99f9a5de-2fb0-476a-bd0c-1d2eb5d80241`) | `DB` |
| KV namespace | `cs-vv-fantasy-cache` (`ef72e9485ffd4407ab0f6883473dd73b`) | `cs-vv-fantasy-cache-staging` (`b99a6153f41d4b268f1073d32a97efd8`) | `CACHE` |
| R2 bucket | `cs-vv-fantasy-assets` | `cs-vv-fantasy-assets-staging` | `STORAGE` (`ASSETS` is taken by OpenNext static files) |
| Queue (scoring jobs) | `cs-vv-fantasy-scoring` | `cs-vv-fantasy-scoring-staging` | `SCORING_QUEUE` |
| Queue (dead letter) | `cs-vv-fantasy-scoring-dlq` | `cs-vv-fantasy-scoring-dlq-staging` | — |

## Workers (deployed 2026-10-29)

| Worker | URL | Purpose |
|---|---|---|
| `cs-vv-fantasy` | https://cs-vv-fantasy.vram-arm.workers.dev | Web app, production |
| `cs-vv-fantasy-staging` | https://cs-vv-fantasy-staging.vram-arm.workers.dev | Web app, staging |
| `cs-vv-fantasy-worker` | https://cs-vv-fantasy-worker.vram-arm.workers.dev | Ingest cron and scoring queue consumer, production |
| `cs-vv-fantasy-worker-staging` | https://cs-vv-fantasy-worker-staging.vram-arm.workers.dev | Same, staging |

Health check: `<web url>/api/health` returns `{"ok":true,"env":"...","db":"ok"}`.

## Secrets

Names only. Values live in Cloudflare (`wrangler secret put <NAME>`) and, for local development, in `.dev.vars` files (git-ignored).

| Name | Used by | Status |
|---|---|---|
| `CITO_API_KEY` | ingest worker | Set on production and staging (free test key). Local copy in `apps/worker/.dev.vars`. Replace with a paid key before launch. |
| `BETTER_AUTH_SECRET` | web | Set on production and staging (random, different per environment). Local copy in `apps/web/.dev.vars`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | web | Needs a Resend account. Until then, emails are not sent. |
| `TURNSTILE_SECRET_KEY` | web | Needs a Turnstile widget |
| `SYNC_TOKEN` | ingest worker | Protects `POST /sync/events` (manual tournament sync). Random value, not stored anywhere. To run a manual sync: `wrangler secret put SYNC_TOKEN` with a new value, then `curl -X POST -H "Authorization: Bearer <value>" <worker url>/sync/events`. |

## Still to do

1. **Check the plan:** Dashboard → Workers & Pages → Plans. The web bundle is 1.7 MB gzipped, so it fits the Free plan's 3 MB limit. The Free plan's 10 ms CPU per request is the risk: password hashing and server rendering can exceed it under load. Workers Paid ($5/month) removes that limit.
2. **Turnstile widget** for `cs-vv-fantasy.vram-arm.workers.dev` and the staging host (site key and secret key).
3. **API token for CI** (GitHub Actions). `CLOUDFLARE_ACCOUNT_ID` is already set in the GitHub repository. To create the token:
   1. Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template.
   2. Add these Account permissions: D1 Edit, Workers KV Storage Edit, Workers R2 Storage Edit, Queues Edit. Account Resources: your account. Zone Resources: none needed.
   3. Copy the token and run `gh secret set CLOUDFLARE_API_TOKEN --repo Vram-Voskanyan/cs-fantasy` (it asks for the value without showing it).
   After that, every push to `main` deploys staging.
4. **Custom domain** (next phase): add the domain to Cloudflare, attach it to the `cs-vv-fantasy` Worker, change `APP_URL`.
