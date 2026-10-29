# cs-vv-fantasy: Design System

| | |
|---|---|
| Status | Draft v0.1 |
| Date | 2026-10-29 |
| Preview | `docs/design-preview.html` (open in a browser) |
| Applies to | `apps/web` (Next.js). Product plan: `docs/PLAN.md` |

---

## 1. Direction: "Tactical HUD"

Dark, angular, data-first. The look borrows from the CS2 in-game HUD and scoreboard: thin lines, cut corners, side colors (CT blue, T gold), numbers that are easy to scan. It is not a copy of any Valve or HLTV asset.

Principles:

1. **Numbers first.** Users come to check points, prices and ranks. Numbers are big, tabular and aligned. Decoration never competes with data.
2. **One signature shape.** A 45° cut corner on buttons and cards. Everything else is calm: flat surfaces, 1px borders.
3. **Glow is a signal, not decoration.** Glow appears only on focus, live state and the primary action on hover.
4. **Motion explains change.** Animate what changed (points, rank, selection). Do not animate for show. Maximum 1 to 2 animated elements per view at a time.
5. **Mobile first.** Most users check scores on a phone during a match.

Rejected options (from the `ui-ux-pro-max` database results):

- "3D & Hyperrealism" (WebGL, parallax): high performance cost and high accessibility risk. Bad for a data-heavy app on phones.
- Generic neon-purple gaming palette: looks like every gaming site. Orange and blue tie the brand to CS (T and CT sides) without using game assets.
- "Russo One + Chakra Petch" font pairing: Chakra Petch has no Cyrillic, and we plan more languages (see `docs/PLAN.md` section 5.7).

---

## 2. Color

Dark theme only at MVP. All colors are CSS variables, so a light theme can be added later by redefining the tokens.

### 2.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0C10` | Page background |
| `--surface-1` | `#11141A` | Cards, panels |
| `--surface-2` | `#181C24` | Raised, hover, selected rows |
| `--surface-3` | `#20252F` | Inputs, pressed states |
| `--border` | `#262C38` | Card and divider lines (decorative) |
| `--border-strong` | `#3A4252` | Hover borders |
| `--border-input` | `#646E83` | Input and control outlines (≥3:1, WCAG 1.4.11) |
| `--fg` | `#E8EBF0` | Main text |
| `--fg-muted` | `#9AA3B2` | Secondary text, labels |
| `--fg-subtle` | `#7A8394` | Hints on `--bg` and `--surface-1` only |
| `--primary` | `#FF6B1A` | Brand, primary buttons, selection, focus ring |
| `--primary-hover` | `#FF8540` | Primary hover |
| `--on-primary` | `#0A0C10` | Text on primary (white on orange fails contrast) |
| `--primary-tint` | `#2A160B` | Background of selected or highlighted items |
| `--accent` | `#9D7BFF` | Roles and boosters only |
| `--accent-tint` | `#1E1838` | Role chip background |
| `--ct` | `#6AA6FF` | CT side stats |
| `--t` | `#E9B949` | T side stats |
| `--positive` | `#2FD27A` | Points gained, rank up, success |
| `--positive-tint` | `#0F2A1C` | Background flash for gains |
| `--negative` | `#FF5470` | Points lost, rank down, errors, over budget |
| `--negative-tint` | `#2A1218` | Error backgrounds |
| `--live` | `#FF4040` | Live badge |
| `--warning` | `#FFC23D` | Lock countdown under 1 hour, data delayed |

### 2.2 Verified contrast (WCAG AA needs 4.5:1 for text, 3:1 for UI parts)

| Pair | Ratio |
|---|---|
| `--fg` on `--bg` / `--surface-1` / `--surface-3` | 16.4 / 15.4 / 12.9 |
| `--fg-muted` on `--surface-1` / `--surface-3` | 7.3 / 6.0 |
| `--fg-subtle` on `--surface-1` | 4.8 (do not use on `--surface-3`: 4.0) |
| `--on-primary` on `--primary` | 6.9 |
| `--primary` on `--surface-1` (text, focus ring) | 6.5 |
| `--accent` on `--accent-tint` | 5.4 |
| `--positive` on `--surface-1` / `--positive-tint` | 9.3 / 7.8 |
| `--negative` on `--surface-1` / `--negative-tint` | 5.9 / 5.6 |
| `--live` on `--surface-1` | 5.3 |
| `--border-input` on `--surface-1` / `--surface-3` | 3.6 / 3.0 |

### 2.3 Rules

- No raw hex values in components. Use tokens only.
- Color is never the only signal. A gain shows `+12.5` with an up arrow, not only green. A disabled player card shows the reason ("Over budget", "Team limit: 2").
- Orange is for action and selection. Violet is only for roles. Blue and gold are only for CT and T side data.

---

## 3. Typography

### 3.1 Fonts

| Role | Font | Why |
|---|---|---|
| Display: headings, big numbers, button labels, ranks | **Tektur** (variable: weight 400–900, width 75–100) | Angular, technical, fits the HUD look. Has Latin, Cyrillic, Greek, Vietnamese. Width axis gives condensed headings without a second font. |
| UI and body: text, tables, forms | **Inter** (variable: weight 100–900, optical size 14–32) | Very readable at small sizes, true tabular numbers, Latin, Cyrillic, Greek, Vietnamese. |

Load both with `next/font/google` (self-hosted, no layout shift). Do not use `<link>` to Google Fonts in the app. Subsets: `latin` and `cyrillic`.

```ts
// apps/web/app/fonts.ts
import { Inter, Tektur } from "next/font/google";

export const fontDisplay = Tektur({
  subsets: ["latin", "cyrillic"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

export const fontBody = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});
```

### 3.2 Type scale

| Token | Size / line height | Font | Use |
|---|---|---|---|
| `display` | 48 / 1.05 (mobile 36) | Tektur 800, width 85 | Hero, final score |
| `h1` | 36 / 1.1 (mobile 28) | Tektur 700 | Page title |
| `h2` | 28 / 1.15 (mobile 24) | Tektur 700 | Section title |
| `h3` | 20 / 1.25 | Tektur 600 | Card title, player nickname |
| `stat` | 32 / 1 (mobile 28) | Tektur 700, tabular | Stat tile numbers, total points |
| `body` | 16 / 1.5 | Inter 400 | Text, inputs (16 px stops iOS zoom on focus) |
| `body-sm` | 14 / 1.45 | Inter 400–500 | Table cells, secondary text |
| `label` | 12 / 1.3, uppercase, letter-spacing 0.08em | Inter 600 | Stat labels, column headers |
| `button` | 14 / 1, uppercase, letter-spacing 0.06em | Tektur 600 | Button labels |

Rules:

- All numbers (points, prices, ranks, K/D, ADR) use `font-variant-numeric: tabular-nums` and are right-aligned in tables.
- Format numbers with `Intl.NumberFormat` (thousand separators, one decimal for points and credits).
- Minimum text size is 12 px, and only for uppercase labels. Body text is never below 14 px.
- Uppercase comes from CSS (`text-transform`), never from the strings file, so translations stay correct.

---

## 4. Space, shape and depth

| Token | Value |
|---|---|
| Spacing scale (4 px base) | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| `--radius-sm` | 4 px (chips, inputs) |
| `--radius-md` | 6 px (buttons without cut, menus) |
| `--cut-sm` | 8 px (button corner cut) |
| `--cut-md` | 12 px (card corner cut) |
| `--shadow-raise` | `0 8px 24px -12px rgb(0 0 0 / 0.6)` |
| `--glow-primary` | `0 0 0 1px rgb(255 107 26 / 0.5), 0 8px 24px -8px rgb(255 107 26 / 0.45)` |

**Signature cut corner.** Buttons cut the top-left and bottom-right corners. Cards cut the top-right corner. The cut is drawn with `clip-path` on a `::before` background layer, not on the element itself. This keeps the focus outline visible (a `clip-path` on the element would clip the outline too). See the preview for the exact CSS.

Background: flat `--bg` with a very faint 32 px grid (opacity 3%) on marketing pages only. No texture behind data.

---

## 5. Buttons

### 5.1 Variants

| Variant | Look | Use |
|---|---|---|
| Primary | `--primary` fill, `--on-primary` text, cut corners | One per view: "Save team", "Join league", "Create account" |
| Secondary | `--surface-2` fill, `--border-strong` outline, `--fg` text, cut corners | Other actions: "Filter", "Invite" |
| Ghost | No fill, `--fg-muted` text; `--surface-2` fill on hover | Low-priority actions, toolbars |
| Danger | `--negative` outline and text; `--negative-tint` fill on hover | "Remove player", "Leave league" |
| Icon | Square, ghost style, always has an `aria-label` | Close, menu, sort |

### 5.2 Sizes

| Size | Height | Padding x | Use |
|---|---|---|---|
| `sm` | 36 px (hit area extended to 44 px) | 12 px | Dense desktop tables |
| `md` | 44 px | 16 px | Default |
| `lg` | 52 px | 24 px | Main call to action, mobile sticky bar |

### 5.3 States

| State | Change | Timing |
|---|---|---|
| Hover (pointer devices only, `@media (hover: hover)`) | Fill lightens (`--primary-hover`); primary adds `--glow-primary`; trailing arrow icon moves 2 px right | 150 ms ease-out |
| Pressed | `translateY(1px) scale(0.98)` | 80 ms |
| Focus visible | 2 px outline `--primary`, offset 2 px | instant |
| Disabled | Opacity 0.45, `cursor: not-allowed`, no hover. Show why nearby if it is not obvious | — |
| Loading | Spinner replaces the leading icon, label stays, width does not change, `aria-busy="true"`, clicks ignored | spinner 700 ms per turn |
| Success (optional, for "Save team") | Label changes to "Saved" with a check for 1.5 s | 150 ms fade |

---

## 6. Cards

All cards: `--surface-1`, 1 px `--border`, cut top-right corner (`--cut-md`), padding 16 px (mobile) or 20 px (desktop). Only interactive cards have hover and press states.

| Card | Content | States and behavior |
|---|---|---|
| **Player card** (team builder, player list) | Avatar (photo if licensed, else initials on `--surface-3`), nickname (h3), team tag and country flag, price in credits, average fantasy points, optional role chip, add or remove button | Default; hover (border `--border-strong`, lift 2 px); **selected** (3 px `--primary` bar on the left, `--primary-tint` background, check icon); **unavailable** (opacity 0.5 and a reason line such as "Over budget by 3.5" or "Team limit: 2"); **locked** (lock icon, no actions) |
| **Team slot** (my team, 5 slots) | Empty: dashed `--border-strong` outline, "+ Add player". Filled: compact player card with role chip | Fills with a short pop when a player is added (section 7) |
| **Match card** | Two teams (tag, logo if licensed), BO format, status: start time, LIVE badge with map score, or final score per map | LIVE: red pulsing dot and "LIVE" label. Final: winner in `--fg`, loser in `--fg-muted` |
| **Stat tile** | Label (uppercase), big number (`stat` style), delta with sign and arrow | Delta in `--positive` or `--negative`, always with `+`/`−` and an arrow |
| **Leaderboard row** | Rank, rank change (arrow and number), user name, team name, points | The current user's row: `--surface-2` background and a `--primary` left bar. Rows reorder with a FLIP animation when ranks change |
| **Role chip** | Role icon and name | `--accent-tint` background, `--accent` text, 28 px high, inside a 44 px hit area when tappable |
| **Budget bar** | "Budget left 12.5 / 100.0", progress fill | Fill is `--primary`. Over budget: fill `--negative` and text "Over budget by 3.5" |

---

## 7. Motion

### 7.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 80 ms | Press feedback |
| `--dur-fast` | 150 ms | Hover, color changes |
| `--dur-base` | 220 ms | Small UI entering: menus, toasts, chips |
| `--dur-slow` | 320 ms | Panels, list reorder, budget bar |
| `--dur-emphasis` | 600 ms | Point count-up |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default for entering and hover |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving between two positions |
| `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small elements only (chips, check marks, slot fill). Never on tables or lists |

Exit animations are about 30% faster than enter animations.

### 7.2 Key moments

| Moment | Animation |
|---|---|
| Player added to team | Team slot pops from `scale(0.96)` to `1` (220 ms, `--ease-pop`). Budget bar fill moves with `transform: scaleX()` (320 ms). |
| Live points update | Number counts up to the new value (600 ms). The row flashes `--positive-tint` (or `--negative-tint`) and fades out over 1.2 s. Screen readers get one polite summary (`aria-live="polite"`), not every tick. |
| Leaderboard rank change | Rows move to the new order with FLIP (320 ms, `--ease-in-out`). Arrow and number show the change. |
| Live badge | Dot pulses (scale and opacity, 1.6 s loop). |
| Loading | Skeleton blocks with the final layout size (no layout shift). Shimmer 1.2 s linear. |
| Lock countdown | Digits change without animation. Under 1 hour the text turns `--warning`. |
| Page change | No page transition at MVP. Content appears with loading skeletons. |

### 7.3 Rules

- Animate only `transform` and `opacity`. Never animate `width`, `height`, `top` or `left`.
- `prefers-reduced-motion: reduce`: count-ups show the final number, pulses stop (static dot), reorders jump, skeletons do not shimmer. Press feedback (color change) stays.
- Hover effects only under `@media (hover: hover)`. Every hover action also works by tap.

### 7.4 Libraries

- CSS transitions for buttons, cards, chips and hover.
- [`motion`](https://motion.dev) (`motion/react`) for list reorder (`layout`), enter and exit (`AnimatePresence`).
- A small `useCountUp` hook (`requestAnimationFrame`) for numbers.
- No GSAP, no WebGL or 3D libraries at MVP: smaller bundle on Workers, faster on phones.

---

## 8. Icons and images

- Icons: [Lucide](https://lucide.dev) SVG, 20 px default (16 px in dense tables), stroke width 1.75. No emoji as icons.
- Icon-only buttons need an `aria-label` from the strings file.
- Team logos and player photos only if the data provider license covers them (see `docs/PLAN.md` section 9). Fallback: team tag in a cut-corner badge, player initials.
- Images: AVIF or WebP, fixed width and height (or aspect ratio), lazy-loaded below the fold.

---

## 9. Layout

- Breakpoints: 375, 768, 1024, 1440 px. Mobile first.
- Content width: max 1280 px, side padding 16 px (mobile) or 24 px (desktop).
- Mobile navigation: bottom bar with 5 items maximum (Home, My team, Live, Leagues, Profile). Desktop: top bar.
- Team builder: on mobile, a player list with a sticky bottom bar (5 slots, budget left, Save). On desktop, two columns: player pool on the left, team panel on the right (sticky).
- Tables: on mobile, each row becomes a compact card. On desktop, a table with a sticky header.
- No horizontal page scroll at any width.

---

## 10. Accessibility checklist

- [ ] Text contrast 4.5:1 and UI parts 3:1 (tokens in section 2 are verified).
- [ ] Visible focus on every interactive element (2 px `--primary` outline).
- [ ] Touch targets at least 44 × 44 px, 8 px apart.
- [ ] Color is never the only signal (signs, arrows, reason text).
- [ ] Form fields have visible labels; errors appear next to the field.
- [ ] `prefers-reduced-motion` respected.
- [ ] Live score region uses `aria-live="polite"`.
- [ ] Keyboard: team builder fully usable without a mouse (add, remove, choose role, save).
- [ ] Layout checked at 375, 768, 1024 and 1440 px.

---

## 11. Implementation notes

- Styling: Tailwind CSS v4. Tokens from this document go in `apps/web/src/app/globals.css` under `@theme`, so classes like `bg-surface-1` and `text-fg-muted` exist. The side colors are named `side-ct` and `side-t` in Tailwind (`text-side-t`), because a color named `t` would clash with the `border-t` utility.
- Components: accessible primitives from shadcn/ui (Radix: dialog, dropdown, tabs, tooltip), restyled with our tokens. Shared components live in `apps/web/components/ui/` (`Button`, `Card`, `PlayerCard`, `StatTile`, `RoleChip`, `LiveBadge`, `BudgetBar`).
- All text comes from `apps/web/i18n/strings_en.json` (see `CLAUDE.md`).
- The preview `docs/design-preview.html` is the reference for the CSS of buttons, cards and motion. Copy its token block into `globals.css` when the app is set up.
