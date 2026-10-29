import { schema } from "@cs-vv-fantasy/db";
import { asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { LiveBadge } from "@/components/tournaments/tournament-meta";
import { buttonClass } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { loadMyTeam } from "@/lib/fantasy";
import { getSession } from "@/lib/session";

const DONE = ["completed", "finished"];

export default async function MatchPage({ params }: PageProps<"/matches/[id]">) {
  const db = await getDb();
  const [match] = await db.select().from(schema.matches).where(eq(schema.matches.id, (await params).id)).limit(1);
  if (!match) notFound();
  const session = await getSession();

  const [t, tT, format, [tournament], teams, maps, mine] = await Promise.all([
    getTranslations("match"),
    getTranslations("tournaments"),
    getFormatter(),
    db.select().from(schema.tournaments).where(eq(schema.tournaments.id, match.tournamentId)).limit(1),
    db
      .select()
      .from(schema.teams)
      .where(inArray(schema.teams.id, [match.team1Id ?? "-", match.team2Id ?? "-"])),
    db.select().from(schema.matchMaps).where(eq(schema.matchMaps.matchId, match.id)).orderBy(asc(schema.matchMaps.mapNumber)),
    session ? loadMyTeam(db, match.tournamentId, session.user.id) : null,
  ]);
  const mapIds = maps.map((m) => m.id);
  const [stats, points] = mapIds.length
    ? await Promise.all([
        db
          .select({ stat: schema.playerMapStats, nickname: schema.players.nickname, slug: schema.players.slug })
          .from(schema.playerMapStats)
          .innerJoin(schema.players, eq(schema.players.id, schema.playerMapStats.playerId))
          .where(inArray(schema.playerMapStats.mapId, mapIds)),
        db.select().from(schema.playerMapPoints).where(inArray(schema.playerMapPoints.mapId, mapIds)),
      ])
    : [[], []];
  const myPlayers = new Set(mine?.picks.map((p) => p.playerId) ?? []);
  const team = (id: string | null) => teams.find((x) => x.id === id) ?? null;
  const team1 = team(match.team1Id);
  const team2 = team(match.team2Id);
  const done = DONE.includes(match.status);
  const num = (n: number | null, digits = 2) => (n === null ? "–" : format.number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  const pct = (n: number | null) => (n === null ? "–" : format.number(n, { style: "percent", maximumFractionDigits: 0 }));

  const side = (x: typeof team1, score: number | null) => (
    <div className={`grid justify-items-center gap-2 text-center ${done && match.winnerTeamId && x && match.winnerTeamId !== x.id ? "text-fg-muted" : ""}`}>
      {x ? (
        <Link href={`/teams/${x.slug}`} className="font-display text-xl font-bold hover:underline md:text-2xl">
          {x.name}
        </Link>
      ) : (
        <span className="font-display text-xl font-bold text-fg-subtle">{tT("tbd")}</span>
      )}
      {x?.vrsRanking ? <span className="badge">{tT("vrs", { rank: x.vrsRanking })}</span> : null}
      <span className="font-display text-5xl font-extrabold tabular-nums">{done || match.status === "live" ? (score ?? "–") : ""}</span>
    </div>
  );

  return (
    <PageShell>
      {tournament ? (
        <Link href={`/tournaments/${tournament.slug}#matches`} className={buttonClass("ghost", "sm", "-ml-3 mb-6")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back", { tournament: tournament.name })}
        </Link>
      ) : null}

      <section className="card grid gap-4">
        <p className="label text-center">
          {[match.stageName, match.bestOf ? tT("bestOf", { n: match.bestOf }) : null].filter(Boolean).join(" · ")}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {side(team1, match.team1Score)}
          <span className="text-fg-muted">{tT("vs")}</span>
          {side(team2, match.team2Score)}
        </div>
        <p className="text-center text-sm text-fg-muted">
          {match.status === "live" ? (
            <LiveBadge />
          ) : done ? (
            tT("final")
          ) : match.startsAt ? (
            format.dateTime(match.startsAt, { dateStyle: "medium", timeStyle: "short" })
          ) : (
            tT("tbd")
          )}
        </p>
      </section>

      {maps.length === 0 || stats.length === 0 ? <p className="card mt-8 text-fg-muted">{t("notPlayed")}</p> : null}

      {maps.map((map) => {
        const mapStats = stats.filter((s) => s.stat.mapId === map.id);
        if (mapStats.length === 0) return null;
        return (
          <section key={map.id} className="mt-10" aria-labelledby={`map-${map.mapNumber}`}>
            <h2 id={`map-${map.mapNumber}`} className="mb-3 flex flex-wrap items-baseline gap-x-3 font-display text-2xl font-bold">
              {map.mapName ? t("mapName", { n: map.mapNumber, name: map.mapName }) : t("map", { n: map.mapNumber })}
              <span className="font-display text-lg tabular-nums text-fg-muted">
                {map.team1Score ?? "–"} : {map.team2Score ?? "–"}
              </span>
              {map.durationRounds ? <span className="font-sans text-sm font-normal text-fg-muted">{t("rounds", { count: map.durationRounds })}</span> : null}
            </h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {[team1, team2].map((x) => {
                const rows = mapStats.filter((s) => s.stat.teamId === x?.id).sort((a, b) => (b.stat.rating ?? 0) - (a.stat.rating ?? 0));
                if (!x || rows.length === 0) return null;
                return (
                  <div key={x.id} className="overflow-x-auto rounded-[6px] border border-border">
                    <table className="w-full min-w-[620px] text-sm">
                      <caption className="bg-surface-2 px-3 py-2 text-left font-display font-semibold">
                        {x.name} {map.winnerTeamId === x.id ? <span className="ml-2 text-xs text-positive">{tT("final")}</span> : null}
                      </caption>
                      <thead className="bg-surface-1">
                        <tr className="label text-left">
                          <th className="px-3 py-2">{t("player")}</th>
                          <th className="px-3 py-2 text-right">{t("kda")}</th>
                          <th className="px-3 py-2 text-right">{t("plusMinus")}</th>
                          <th className="px-3 py-2 text-right">{t("adr")}</th>
                          <th className="px-3 py-2 text-right">{t("kast")}</th>
                          <th className="px-3 py-2 text-right">{t("hs")}</th>
                          <th className="px-3 py-2 text-right">{t("openings")}</th>
                          <th className="px-3 py-2 text-right">{t("rating")}</th>
                          <th className="px-3 py-2 text-right">{t("points")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ stat, nickname, slug }) => {
                          const p = points.find((x2) => x2.mapId === map.id && x2.playerId === stat.playerId);
                          const isMine = myPlayers.has(stat.playerId);
                          return (
                            <tr key={stat.playerId} className={`border-t border-border tabular-nums ${isMine ? "bg-primary-tint" : ""}`}>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1.5">
                                  <Link href={`/players/${slug}`} className="font-medium hover:underline">
                                    {nickname}
                                  </Link>
                                  {isMine ? <Check className="size-4 text-primary" aria-label={t("pickedBy")} /> : null}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {stat.kills} / {stat.deaths} / {stat.assists}
                              </td>
                              <td className={`px-3 py-2 text-right ${(stat.plusMinus ?? 0) > 0 ? "text-positive" : (stat.plusMinus ?? 0) < 0 ? "text-negative" : ""}`}>
                                {stat.plusMinus === null ? "–" : `${stat.plusMinus > 0 ? "+" : ""}${stat.plusMinus}`}
                              </td>
                              <td className="px-3 py-2 text-right">{num(stat.adr, 1)}</td>
                              <td className="px-3 py-2 text-right">{pct(stat.kast)}</td>
                              <td className="px-3 py-2 text-right">{pct(stat.headshotPercent)}</td>
                              <td className="px-3 py-2 text-right">
                                {stat.openingKills ?? "–"} / {stat.openingDeaths ?? "–"}
                              </td>
                              <td className="px-3 py-2 text-right">{num(stat.rating)}</td>
                              <td className="px-3 py-2 text-right font-display font-bold">{p ? num(p.base, 1) : "–"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
