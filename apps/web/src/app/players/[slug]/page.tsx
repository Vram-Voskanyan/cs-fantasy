import { schema } from "@cs-vv-fantasy/db";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { getDb } from "@/lib/db";

const RECENT_MAPS = 20;

export async function generateMetadata({ params }: PageProps<"/players/[slug]">) {
  const db = await getDb();
  const [p] = await db.select({ nickname: schema.players.nickname }).from(schema.players).where(eq(schema.players.slug, (await params).slug)).limit(1);
  return { title: p?.nickname };
}

export default async function PlayerPage({ params }: PageProps<"/players/[slug]">) {
  const db = await getDb();
  const [player] = await db.select().from(schema.players).where(eq(schema.players.slug, (await params).slug)).limit(1);
  if (!player) notFound();
  const [t, format, membership, recent, prices] = await Promise.all([
    getTranslations("player"),
    getFormatter(),
    db
      .select({ team: schema.teams.name, slug: schema.teams.slug, tag: schema.teams.tag, role: schema.teamPlayers.role })
      .from(schema.teamPlayers)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.teamPlayers.teamId))
      .where(and(eq(schema.teamPlayers.playerId, player.id), eq(schema.teamPlayers.isActive, true)))
      .limit(1),
    db
      .select({
        mapId: schema.playerMapStats.mapId,
        mapName: schema.matchMaps.mapName,
        startsAt: schema.matches.startsAt,
        kills: schema.playerMapStats.kills,
        deaths: schema.playerMapStats.deaths,
        assists: schema.playerMapStats.assists,
        adr: schema.playerMapStats.adr,
        kast: schema.playerMapStats.kast,
        rating: schema.playerMapStats.rating,
        headshotPercent: schema.playerMapStats.headshotPercent,
        base: schema.playerMapPoints.base,
      })
      .from(schema.playerMapStats)
      .innerJoin(schema.matchMaps, eq(schema.matchMaps.id, schema.playerMapStats.mapId))
      .innerJoin(schema.matches, eq(schema.matches.id, schema.matchMaps.matchId))
      .leftJoin(schema.playerMapPoints, and(eq(schema.playerMapPoints.mapId, schema.playerMapStats.mapId), eq(schema.playerMapPoints.playerId, player.id)))
      .where(eq(schema.playerMapStats.playerId, player.id))
      .orderBy(desc(schema.matches.startsAt), desc(schema.matchMaps.mapNumber))
      .limit(RECENT_MAPS),
    db
      .select({ tournament: schema.tournaments.name, price: schema.poolPlayers.price })
      .from(schema.poolPlayers)
      .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.poolPlayers.tournamentId))
      .where(eq(schema.poolPlayers.playerId, player.id)),
  ]);
  const team = membership[0];
  const num = (n: number | null, digits = 2) => (n === null ? "–" : format.number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  const pct = (n: number | null) => (n === null ? "–" : format.number(n, { style: "percent", maximumFractionDigits: 0 }));
  const facts = [
    {
      label: t("team"),
      value: team ? (
        <Link href={`/teams/${team.slug}`} className="hover:underline">
          {team.team}
        </Link>
      ) : null,
    },
    { label: t("role"), value: team?.role ?? null },
    { label: t("country"), value: player.countryName },
    { label: t("age"), value: player.age === null ? null : String(player.age) },
    { label: t("rating"), value: player.rating === null ? null : num(player.rating) },
    { label: t("maps"), value: player.mapsPlayed === null ? null : String(player.mapsPlayed) },
    ...prices.map((p) => ({ label: t("price", { tournament: p.tournament }), value: num(p.price / 10, 1) })),
  ].filter((f) => f.value);

  return (
    <PageShell>
      <h1 className="font-display text-4xl font-extrabold md:text-5xl">{player.nickname}</h1>
      {player.realName ? <p className="mt-2 text-fg-muted">{player.realName}</p> : null}

      <dl className="card mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="label">{f.label}</dt>
            <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="recent-title">
        <h2 id="recent-title" className="mb-4 font-display text-2xl font-bold">
          {t("recent")}
        </h2>
        {recent.length === 0 ? (
          <p className="card text-fg-muted">{t("noMaps")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="label text-left">
                  <th className="py-2 pr-3" />
                  <th className="py-2 pr-3 text-right">{t("kda")}</th>
                  <th className="py-2 pr-3 text-right">{t("adr")}</th>
                  <th className="py-2 pr-3 text-right">{t("kast")}</th>
                  <th className="py-2 pr-3 text-right">{t("hs")}</th>
                  <th className="py-2 pr-3 text-right">{t("rating")}</th>
                  <th className="py-2 text-right">{t("fantasyPoints")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.mapId} className="border-t border-border tabular-nums">
                    <td className="py-2 pr-3">
                      {r.mapName ?? "–"}
                      <span className="block text-xs text-fg-muted">{r.startsAt ? format.dateTime(r.startsAt, { day: "numeric", month: "short" }) : null}</span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.kills} / {r.deaths} / {r.assists}
                    </td>
                    <td className="py-2 pr-3 text-right">{num(r.adr, 1)}</td>
                    <td className="py-2 pr-3 text-right">{pct(r.kast)}</td>
                    <td className="py-2 pr-3 text-right">{pct(r.headshotPercent)}</td>
                    <td className="py-2 pr-3 text-right">{num(r.rating)}</td>
                    <td className="py-2 text-right font-display font-bold">{r.base === null ? "–" : num(r.base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
