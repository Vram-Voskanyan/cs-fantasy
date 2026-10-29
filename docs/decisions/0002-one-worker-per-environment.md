# 0002: One Worker per environment

Date: 2026-10-29 · Status: accepted (replaces the separate background Worker from 0001)

## Decision

The web app and the background jobs run in the same Worker: `cs-vv-fantasy` (production) and `cs-vv-fantasy-staging`.

- `apps/web/worker.ts` is the Worker entry. It passes HTTP requests to Next.js (OpenNext) and adds the `scheduled` handler (data sync cron) and the `queue` handler (scoring jobs).
- Job code lives in `apps/web/src/jobs/`.
- Manual sync: `POST /api/internal/sync/events` with `Authorization: Bearer <SYNC_TOKEN>` (replaced by the admin panel later).

## Why

Fewer things to deploy and watch. Cloudflare bills per request and CPU time, not per Worker, so cost is the same.

## Trade-offs accepted

- A broken deploy affects both the site and the jobs. CI checks health after each deploy.
- Cron and queue runs load the full Next.js bundle (larger cold start). Fine at our job volume.
- Job code is redeployed with the site.
