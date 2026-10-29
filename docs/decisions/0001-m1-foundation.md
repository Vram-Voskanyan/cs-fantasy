# 0001: M1 foundation choices

Date: 2026-10-29 · Status: accepted

## Context

Milestone M1 sets up the repository, the Next.js app on Cloudflare Workers, the database, sign-in, translations and delivery. A few choices differ from `docs/PLAN.md` or are not covered by it.

## Decisions

1. **npm workspaces instead of pnpm.** pnpm and corepack are not installed on the development machine (Node 25 no longer ships corepack). npm workspaces need no extra tool. Switching to pnpm later is cheap.
2. **Next.js 16.4 with `cacheComponents` off.** The template enables Cache Components. With it, every session read must sit behind a Suspense boundary, and OpenNext support for it on Workers is still young. Our pages are mostly per-user and live, and our caching plan is KV snapshots plus client polling (PLAN section 5.4). We use the previous caching model for now and can revisit.
3. **No Next.js middleware or proxy.** OpenNext does not support Node.js middleware, and `proxy.ts` in Next.js 16 runs on Node.js. Auth checks happen in pages and route handlers.
4. **R2 binding is `STORAGE`, not `ASSETS`.** OpenNext already uses the `ASSETS` binding for static files.
5. **Better Auth instance per Worker isolate**, built from the request's Cloudflare bindings (`getAuth()`), because D1 is only reachable through the binding at request time.
6. **Email verification is sent on sign-up but not required yet.** It becomes required before the first team save (M3). Until Resend is configured, links are logged in development and dropped in production.
7. **Staging deploys on every push to `main`; production deploys by a manual workflow.** Matches "push directly to `main`" while keeping one manual step before users see a change.

## Consequences

- `npm audit` reports issues in build-time tools only (`drizzle-kit` via esbuild's dev server, `@opennextjs/aws` via the `glob` CLI). They do not ship in the Worker. Re-check on upgrades.
- The Worker bundle is about 1.7 MB gzipped, under the 3 MB Free plan limit.
