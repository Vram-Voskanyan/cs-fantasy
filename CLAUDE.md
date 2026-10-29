# cs-vv-fantasy

Fantasy game for professional CS2 tournaments. Next.js on Cloudflare Workers (OpenNext), D1, KV, R2, Queues.

The product and technical plan is `docs/PLAN.md`. Read it before starting a feature.

## Rules

- **No hard-coded game numbers.** Points, thresholds, budgets, roster limits, map-count mode, format factors, transfer rules, pricing weights and league limits come from the game config (`docs/PLAN.md` section 7.1). The admin edits them in the admin panel. Defaults live in the default config, not in components or scoring code.
- **No user-facing text in components.** Every string the user can see is a key in `apps/web/i18n/strings_en.json` (one file per language: `strings_<code>.json`). This includes role names, rule labels, errors and emails. Format dates and numbers with `Intl`. See `docs/PLAN.md` section 5.7.
- **UI follows `docs/DESIGN.md`.** Use design tokens only (no raw hex in components). Reference CSS for buttons, cards and motion: `docs/design-preview.html`. Respect `prefers-reduced-motion`.
- **Validate team rules on the server**, with values from the active game config. Enforce locks with server time.
- **Money-like values are integers** (credits × 10, cents). Never floats.
- **Git:** commit and push directly to `main`. No pull requests for now. A push to `main` deploys staging, then production.
- **Data fields match the Cito API.** Store and show only fields the provider actually returns (see `docs/PLAN.md` section 4.2). Fake data for testing uses the same shape. Production may hold fake data until launch; it is reset before going live.
