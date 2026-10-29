"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { TournamentFilter } from "@/lib/tournaments";

const STATUSES = ["all", "live", "upcoming", "finished"] as const;
const TIERS = ["S", "A", "B", "C", "other"];

/** Filters live in the URL (?status=live&tier=S&fantasy=open), so a filtered list can be shared. */
export function TournamentFilters({ value }: { value: TournamentFilter }) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, next: string | null) {
    const search = new URLSearchParams(params.toString());
    if (next) search.set(key, next);
    else search.delete(key);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const label = { all: t("filterAll"), live: t("filterLive"), upcoming: t("filterUpcoming"), finished: t("filterFinished") };

  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div role="radiogroup" aria-label={t("filterStatus")} className="flex flex-wrap gap-1 rounded-[6px] border border-border bg-surface-1 p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value.status === s}
            onClick={() => update("status", s === "all" ? null : s)}
            className={`h-9 rounded-[4px] px-3 font-display text-xs font-semibold tracking-[0.06em] uppercase transition-colors ${
              value.status === s ? "bg-primary text-on-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {label[s]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">{t("filterTier")}</span>
        <select className="input h-10 w-40" value={value.tier ?? ""} onChange={(e) => update("tier", e.target.value || null)}>
          <option value="">{t("filterAllTiers")}</option>
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier === "other" ? t("filterOtherTier") : t("tier", { tier })}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-[var(--primary)]"
          checked={value.fantasyOpen}
          onChange={(e) => update("fantasy", e.target.checked ? "open" : null)}
        />
        {t("filterFantasyOpen")}
      </label>
    </div>
  );
}
