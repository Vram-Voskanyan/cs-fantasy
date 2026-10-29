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
| R2 bucket | `cs-vv-fantasy-assets` | `cs-vv-fantasy-assets-staging` | `ASSETS` |
| Queue (scoring jobs) | `cs-vv-fantasy-scoring` | `cs-vv-fantasy-scoring-staging` | `SCORING_QUEUE` |
| Queue (dead letter) | `cs-vv-fantasy-scoring-dlq` | `cs-vv-fantasy-scoring-dlq-staging` | — |

Workers (`cs-vv-fantasy`, `cs-vv-fantasy-worker`, and their `-staging` versions) are created by the first `wrangler deploy` in milestone M1.

## Secrets

Names only. Values live in Cloudflare (`wrangler secret put <NAME>`) and, for local development, in `.dev.vars` files (git-ignored).

| Name | Used by | Status |
|---|---|---|
| `CITO_API_KEY` | ingest worker | Free test key saved in local `.dev.vars`. Upload with `wrangler secret put` after the first deploy. Replace with a paid key before launch. |
| `BETTER_AUTH_SECRET` | web | To generate in M1 (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | web | Needs a Resend account |
| `TURNSTILE_SECRET_KEY` | web | Needs a Turnstile widget |

## Still to do

1. **Check the plan:** Dashboard → Workers & Pages → Plans. The Next.js app needs Workers Paid ($5/month): the free plan allows 3 MB per Worker and 10 ms CPU per request.
2. **Turnstile widget** for `cs-vv-fantasy.vram-arm.workers.dev` and the staging host (site key and secret key).
3. **API token for CI** (GitHub Actions): Workers Scripts edit, D1 edit, Workers KV edit, Workers R2 edit, Queues edit, Account read. Store as GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Needs a GitHub repository first.
4. **Custom domain** (next phase): add the domain to Cloudflare, attach it to the `cs-vv-fantasy` Worker, change `APP_URL`.
