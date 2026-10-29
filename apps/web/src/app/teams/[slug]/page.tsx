import { schema } from "@cs-vv-fantasy/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { MatchCard } from "@/components/tournaments/match-card";
import { formatDates, TierBadge } from "@/components/tournaments/tournament-meta";
import { getDb } from "@/lib/db";
import type { ViewMatch } from "@/lib/tournament-view";

const MATCHES_SHOWN = 12;

export async function generateMetadata({ params }: PageProps<"/teams/[slug]">) {
  const db = await getDb();
  const [team] = await db.select({ name: schema.teams.name }).from(schema.teams).where(eq(schema.teams.slug, (await params).slug)).limit(1);
  return { title: team?.name };
}

export default async function TeamPage({ params }: PageProps<"/teams/[slug]">) {
  const db = await getDb();
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.slug, (await params).slug)).limit(1);
  if (!team) notFound();

  const [t, format, roster, tournaments, matchRows] = await Promise.all([
    getTranslations("team"),
    getFormatter(),
    db
      .select({ player: schema.players, role: schema.teamPlayers.role })
      .from(schema.teamPlayers)
      .innerJoin(schema.players, eq(schema.players.id, schema.teamPlayers.playerId))
      .where(and(eq(schema.teamPlayers.teamId, team.id), eq(schema.teamPlayers.isActive, true)))
      .orderBy(asc(schema.players.nickname)),
    db
      .select({ tournament: schema.tournaments })
      .from(schema.tournamentTeams)
      .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.tournamentTeams.tournamentId))
      .where(eq(schema.tournamentTeams.teamId, team.id))
      .orderBy(desc(schema.tournaments.startsAt)),
    db
      .select()
      .from(schema.matches)
      .where(or(eq(schema.matches.team1Id, team.id), eq(schema.matches.team2Id, team.id)))
      .orderBy(desc(schema.matches.startsAt))
      .limit(MATCHES_SHOWN),
  ]);
  const opponentIds = [...new Set(matchRows.flatMap((m) => [m.team1Id, m.team2Id]).filter((x): x is string => !!x))];
  const names = new Map(
    (
      await db
        .select({ id: schema.teams.id, name: schema.teams.name, tag: schema.teams.tag, slug: schema.teams.slug })
        .from(schema.teams)
        .where(inArray(schema.teams.id, [...opponentIds, "-"]))
    ).map((x) => [x.id, { id: x.id, name: x.name, tag: x.tag ?? x.name, slug: x.slug }]),
  );
  const matches: ViewMatch[] = matchRows.map((m) => ({
    id: m.id,
    stageName: m.stageName,
    startsAt: m.startsAt,
    bestOf: m.bestOf,
    status: m.status,
    team1: m.team1Id ? (names.get(m.team1Id) ?? null) : null,
    team2: m.team2Id ? (names.get(m.team2Id) ?? null) : null,
    team1Score: m.team1Score,
    team2Score: m.team2Score,
    winnerTeamId: m.winnerTeamId,
    myPlayers: 0,
  }));
  const dates = new Map(await Promise.all(tournaments.map(async ({ tournament }) => [tournament.id, await formatDates(tournament)] as const)));
  const facts = [
    { label: t("vrs"), value: team.vrsRanking ? `#${team.vrsRanking}` : null },
    { label: t("world"), value: team.worldRanking ? `#${team.worldRanking}` : null },
    { label: t("country"), value: team.countryName },
    { label: t("region"), value: team.region },
  ].filter((f) => f.value);

  return (
    <PageShell>
      {team.tag && team.tag !== team.name ? <p className="label text-primary!">{team.tag}</p> : null}
      <h1 className="mt-1 font-display text-4xl font-extrabold md:text-5xl">{team.name}</h1>

      {facts.length ? (
        <dl className="card mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="label">{f.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="mt-12" aria-labelledby="roster-title">
        <h2 id="roster-title" className="mb-4 font-display text-2xl font-bold">
          {t("roster")}
        </h2>
        {roster.length === 0 ? (
          <p className="card text-fg-muted">{t("noRoster")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {roster.map(({ player, role }) => (
              <li key={player.id}>
                <Link href={`/players/${player.slug}`} className="card card-link grid gap-1">
                  <span className="font-display text-lg font-bold">{player.nickname}</span>
                  {player.realName ? <span className="truncate text-sm text-fg-muted">{player.realName}</span> : null}
                  <span className="mt-2 flex flex-wrap gap-x-3 text-sm text-fg-muted">
                    {role ? <span>{role}</span> : null}
                    {player.countryCode ? <span>{player.countryCode}</span> : null}
                    {player.rating !== null ? (
                      <span className="tabular-nums">
                        {t("rating")} {format.number(player.rating, { minimumFractionDigits: 2 })}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tournaments.length ? (
        <section className="mt-12" aria-labelledby="team-tournaments-title">
          <h2 id="team-tournaments-title" className="mb-4 font-display text-2xl font-bold">
            {t("tournaments")}
          </h2>
          <ul className="grid gap-2">
            {tournaments.map(({ tournament }) => (
              <li key={tournament.id}>
                <Link href={`/tournaments/${tournament.slug}`} className="card card-link flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <TierBadge tier={tournament.tier} />
                    <span className="font-display font-semibold">{tournament.name}</span>
                  </span>
                  <span className="text-sm text-fg-muted tabular-nums">{dates.get(tournament.id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="team-matches-title">
        <h2 id="team-matches-title" className="mb-4 font-display text-2xl font-bold">
          {t("matches")}
        </h2>
        {matches.length === 0 ? (
          <p className="card text-fg-muted">{t("noMatches")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
