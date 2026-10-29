import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { liveStatus, type Tournament } from "@/lib/tournaments";
import { FantasyBadge } from "./fantasy-badge";
import { formatDates, formatPrize, LiveBadge, TierBadge } from "./tournament-meta";

export async function TournamentCard({ tournament, now }: { tournament: Tournament; now: Date }) {
  const [t, format, dates, prize] = await Promise.all([
    getTranslations("tournaments"),
    getFormatter(),
    formatDates(tournament),
    formatPrize(tournament),
  ]);
  const status = liveStatus(tournament, now);

  return (
    <Link href={`/tournaments/${tournament.slug}`} className="card card-link h-full">
      <article className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={tournament.tier} />
            <FantasyBadge status={tournament.fantasyStatus} />
          </div>
          {status === "live" ? (
            <LiveBadge />
          ) : tournament.startsAt ? (
            <span className="text-sm text-fg-muted">
              {t("startsIn", { when: format.relativeTime(tournament.startsAt, now) })}
            </span>
          ) : null}
        </div>
        <h3 className="font-display text-xl leading-tight font-semibold text-balance">{tournament.name}</h3>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-sm">
          <div className="grid gap-0.5 text-fg-muted">
            {dates ? <span className="tabular-nums">{dates}</span> : null}
            <span>
              {[tournament.location, tournament.isLan === null ? null : tournament.isLan ? t("lan") : t("online")]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold tabular-nums">{prize ?? t("prizeTbd")}</p>
            {tournament.teamCount ? <p className="text-fg-muted">{t("teams", { count: tournament.teamCount })}</p> : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
