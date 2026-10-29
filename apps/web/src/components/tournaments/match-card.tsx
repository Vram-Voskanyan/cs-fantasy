import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ViewMatch } from "@/lib/tournament-view";
import { LiveBadge } from "./tournament-meta";

const DONE = ["completed", "finished"];

/** Compact match: both teams with map score, status or start time, and how many of the user's players play. */
export async function MatchCard({ match }: { match: ViewMatch }) {
  const [t, format] = await Promise.all([getTranslations("tournaments"), getFormatter()]);
  const done = DONE.includes(match.status);
  const live = match.status === "live";
  const row = (team: ViewMatch["team1"], score: number | null) => {
    const lost = done && match.winnerTeamId && team && match.winnerTeamId !== team.id;
    const won = done && team && match.winnerTeamId === team.id;
    return (
      <div className={`flex items-center justify-between gap-3 ${lost ? "text-fg-muted" : ""}`}>
        <span className={`truncate ${won ? "font-semibold" : ""}`} title={team?.name}>
          {team ? (
            <Link href={`/teams/${team.slug}`} className="relative z-10 hover:underline">
              {team.name}
            </Link>
          ) : (
            <span className="text-fg-subtle">{t("tbd")}</span>
          )}
        </span>
        <span className={`font-display tabular-nums ${won ? "font-bold text-fg" : ""}`}>{done || live ? (score ?? "–") : ""}</span>
      </div>
    );
  };
  return (
    <article className={`match-card card-link ${match.myPlayers > 0 ? "is-mine" : ""} ${live ? "is-live" : ""}`}>
      <Link href={`/matches/${match.id}`} className="absolute inset-0 rounded-[6px]" aria-label={t("matchDetails")} />
      {row(match.team1, match.team1Score)}
      {row(match.team2, match.team2Score)}
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
        <span>
          {live ? (
            <LiveBadge />
          ) : done ? (
            t("final")
          ) : match.startsAt ? (
            format.dateTime(match.startsAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          ) : (
            t("tbd")
          )}
          {match.bestOf ? ` · ${t("bestOf", { n: match.bestOf })}` : ""}
        </span>
        {match.myPlayers > 0 ? <span className="text-primary">{t("yourPlayersInMatch", { count: match.myPlayers })}</span> : null}
      </div>
    </article>
  );
}
