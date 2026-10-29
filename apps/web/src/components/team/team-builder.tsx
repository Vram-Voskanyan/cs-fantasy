"use client";

import type { RoleId } from "@cs-vv-fantasy/scoring";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { saveTeam } from "@/app/tournaments/[slug]/team/actions";
import { Button } from "@/components/ui/button";
import type { PoolPlayer } from "@/lib/fantasy";

type Pick = { playerId: string; role: RoleId | null };

export type BuilderProps = {
  tournamentId: string;
  stageName: string;
  lockAt: string;
  size: number;
  budget: number;
  maxPerTeam: number;
  uniqueRoles: boolean;
  roles: { id: RoleId; params: Record<string, string | number> }[];
  pool: PoolPlayer[];
  initialName: string;
  initialPicks: Pick[];
};

type Sort = "priceDesc" | "priceAsc" | "rating";

export function TeamBuilder(props: BuilderProps) {
  const t = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const [name, setName] = useState(props.initialName);
  const [picks, setPicks] = useState<Pick[]>(props.initialPicks.filter((p) => props.pool.some((x) => x.playerId === p.playerId)));
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [sort, setSort] = useState<Sort>("priceDesc");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  const byId = useMemo(() => new Map(props.pool.map((p) => [p.playerId, p])), [props.pool]);
  const picked = picks.map((p) => ({ ...p, player: byId.get(p.playerId)! }));
  const spent = picked.reduce((s, p) => s + p.player.price, 0);
  const left = props.budget - spent;
  const credits = (n: number) => format.number(n / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const teams = useMemo(() => [...new Map(props.pool.map((p) => [p.teamId, p.teamName])).entries()], [props.pool]);

  function reason(p: PoolPlayer) {
    if (picks.some((x) => x.playerId === p.playerId)) return t("builder.reasonPicked");
    if (picks.length >= props.size) return t("builder.reasonFull");
    if (picked.filter((x) => x.player.teamId === p.teamId).length >= props.maxPerTeam)
      return t("builder.reasonTeamLimit", { max: props.maxPerTeam, team: p.teamTag ?? p.teamName });
    if (p.price > left) return t("builder.reasonBudget", { amount: credits(p.price - left) });
    return null;
  }

  function freeRole(): RoleId | null {
    if (props.roles.length === 0) return null;
    const used = new Set(picks.map((p) => p.role));
    return props.roles.find((r) => !props.uniqueRoles || !used.has(r.id))?.id ?? null;
  }

  const visible = props.pool
    .filter((p) => (!teamFilter || p.teamId === teamFilter) && p.nickname.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (sort === "priceAsc" ? a.price - b.price : sort === "rating" ? (b.rating ?? 0) - (a.rating ?? 0) : b.price - a.price));

  function save() {
    start(async () => {
      const result = await saveTeam(props.tournamentId, { name, picks });
      if (result.ok) {
        setMessage({ ok: true, text: t("builder.saved") });
        router.refresh();
      } else {
        setMessage({ ok: false, text: t(`teamErrors.${result.error}` as "teamErrors.notOpen", result.values as never) });
      }
    });
  }

  const lockDate = new Date(props.lockAt);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <section aria-labelledby="pool-title" className="order-2 grid gap-4 lg:order-1">
        <h2 id="pool-title" className="sr-only">
          {t("builder.search")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            type="search"
            placeholder={t("builder.search")}
            aria-label={t("builder.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input" aria-label={t("builder.allTeams")} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">{t("builder.allTeams")}</option>
            {teams.map(([id, teamName]) => (
              <option key={id} value={id}>
                {teamName}
              </option>
            ))}
          </select>
          <select className="input" aria-label={t("builder.sort")} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="priceDesc">{t("builder.sortPriceDesc")}</option>
            <option value="priceAsc">{t("builder.sortPriceAsc")}</option>
            <option value="rating">{t("builder.sortRating")}</option>
          </select>
        </div>
        <ul className="grid gap-2">
          {visible.map((p) => {
            const why = reason(p);
            const isPicked = picks.some((x) => x.playerId === p.playerId);
            return (
              <li
                key={p.playerId}
                className={`card flex items-center gap-3 py-3! ${isPicked ? "[--card-bg:var(--primary-tint)] [--card-edge:rgb(255_107_26/0.55)]" : ""}`}
              >
                <div className="grid size-10 shrink-0 place-items-center bg-surface-3 font-display text-sm font-bold text-fg-muted" aria-hidden="true">
                  {p.nickname.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-display font-semibold">
                    {p.nickname}
                    {isPicked ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
                    <span className="badge h-5!">{p.teamTag ?? p.teamName}</span>
                    {p.countryCode ? <span>{p.countryCode}</span> : null}
                    {p.citoRole ? <span>{p.citoRole}</span> : null}
                    {p.rating !== null ? (
                      <span className="tabular-nums">
                        {t("builder.rating")} {format.number(p.rating, { minimumFractionDigits: 2 })}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="grid justify-items-end gap-1 text-right">
                  <span className="font-display text-lg font-bold tabular-nums">{credits(p.price)}</span>
                  {why && !isPicked ? (
                    <span className="text-xs text-negative">{why}</span>
                  ) : isPicked ? null : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setPicks((list) => [...list, { playerId: p.playerId, role: freeRole() }])}
                      aria-label={`${t("builder.add")} ${p.nickname}`}
                    >
                      {t("builder.add")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside aria-labelledby="team-title" className="card order-1 grid gap-4 lg:sticky lg:top-6 lg:order-2">
        <div>
          <h2 id="team-title" className="font-display text-xl font-bold">
            {t("builder.title")}
          </h2>
          <p className="text-sm text-fg-muted">
            {t("builder.stage", { name: props.stageName })} ·{" "}
            <span className={lockDate.getTime() - now.getTime() < 3_600_000 ? "text-warning" : ""}>
              {t("builder.locksIn", { when: format.relativeTime(lockDate, now) })}
            </span>
          </p>
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          {t("builder.teamName")}
          <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-describedby="team-name-hint" />
          <span id="team-name-hint" className="text-xs font-normal text-fg-muted">
            {t("builder.teamNameHint")}
          </span>
        </label>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label">{t("builder.budgetLeft")}</span>
            <span className={`font-display text-lg font-bold tabular-nums ${left < 0 ? "text-negative" : ""}`}>
              {credits(left)} <span className="text-sm font-normal text-fg-muted">/ {credits(props.budget)}</span>
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-[2px] bg-surface-3"
            role="progressbar"
            aria-label={t("builder.budgetLeft")}
            aria-valuemin={0}
            aria-valuemax={props.budget}
            aria-valuenow={spent}
          >
            <div
              className="h-full w-full origin-left bg-primary transition-transform duration-300"
              style={{ transform: `scaleX(${Math.min(1, spent / props.budget)})` }}
            />
          </div>
          <p className="mt-1 text-xs text-fg-muted">{t("builder.pickedCount", { count: picks.length, size: props.size })}</p>
        </div>

        <ul className="grid gap-2">
          {Array.from({ length: props.size }, (_, i) => {
            const p = picked[i];
            if (!p) {
              return (
                <li key={`empty-${i}`} className="grid h-14 place-items-center rounded-[6px] border border-dashed border-border-strong text-sm text-fg-subtle">
                  {t("builder.slotEmpty")}
                </li>
              );
            }
            return (
              <li key={p.playerId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[6px] border border-border-strong bg-surface-2 p-2">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">
                    {p.player.nickname} <span className="text-xs font-normal text-fg-muted">{p.player.teamTag ?? p.player.teamName}</span>
                  </p>
                  {props.roles.length > 0 ? (
                    <select
                      className="input mt-1 h-9 text-sm"
                      aria-label={`${t("builder.role")} ${p.player.nickname}`}
                      value={p.role ?? ""}
                      onChange={(e) => setPicks((list) => list.map((x) => (x.playerId === p.playerId ? { ...x, role: (e.target.value || null) as RoleId | null } : x)))}
                    >
                      <option value="">{t("roles.none")}</option>
                      {props.roles.map((r) => (
                        <option key={r.id} value={r.id} disabled={props.uniqueRoles && picks.some((x) => x.role === r.id && x.playerId !== p.playerId)}>
                          {t(`roles.${r.id}.name`)} · {t(`roles.${r.id}.description`, r.params as never)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="grid justify-items-end gap-1">
                  <span className="text-sm tabular-nums">{credits(p.player.price)}</span>
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-fg-muted hover:text-negative"
                    aria-label={t("builder.remove", { name: p.player.nickname })}
                    onClick={() => setPicks((list) => list.filter((x) => x.playerId !== p.playerId))}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <Button variant="primary" size="lg" loading={pending} disabled={pending || picks.length !== props.size} onClick={save}>
          {t("builder.save")}
        </Button>
        {message ? (
          <p role="status" className={`text-sm ${message.ok ? "text-positive" : "text-negative"}`}>
            {message.text}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
