import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { TournamentMatches } from "@/components/tournaments/bracket";
import { FantasyBadge } from "@/components/tournaments/fantasy-badge";
import { PlayersTable } from "@/components/tournaments/players-table";
import { TeamsGrid } from "@/components/tournaments/teams-grid";
import { formatDates, formatPrize, LiveBadge, TierBadge } from "@/components/tournaments/tournament-meta";
import { buttonClass } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loadTournamentView } from "@/lib/tournament-view";
import { getTournamentBySlug, liveStatus } from "@/lib/tournaments";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { tournamentLeaderboard } from "@/lib/leaderboard";

const PANEL_TEXT = {
  none: "fantasyPanelNone",
  announced: "fantasyPanelSoon",
  open: "fantasyPanelOpen",
  locked: "fantasyPanelLocked",
  finished: "fantasyPanelFinished",
} as const;

export async function generateMetadata({ params }: PageProps<"/tournaments/[slug]">) {
  const tournament = await getTournamentBySlug((await params).slug);
  return { title: tournament?.name };
}

export default async function TournamentPage({ params }: PageProps<"/tournaments/[slug]">) {
  const tournament = await getTournamentBySlug((await params).slug);
  if (!tournament) notFound();

  const now = new Date();
  const db = await getDb();
  const session = await getSession();
  const [t, tNav, tRoles, format, dates, prize, view] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("nav"),
    getTranslations("roles"),
    getFormatter(),
    formatDates(tournament),
    formatPrize(tournament),
    loadTournamentView(db, tournament, session?.user.id ?? null, now),
  ]);
  const leaderboard = tournament.fantasyStatus === "none" ? [] : await tournamentLeaderboard(db, tournament.id);
  const status = liveStatus(tournament, now);
  const playable = ["open", "locked", "finished"].includes(tournament.fantasyStatus) && !!session;
  // "open" with every stage already locked plays like "locked".
  const panelStatus = tournament.fantasyStatus === "open" && !view.editable ? "locked" : tournament.fantasyStatus;
  const pts = (n: number) => format.number(n, { maximumFractionDigits: 2 });
  const facts = [
    { label: t("dates"), value: dates },
    {
      label: t("location"),
      value: [tournament.location, tournament.isLan === null ? null : tournament.isLan ? t("lan") : t("online")].filter(Boolean).join(" · "),
    },
    { label: t("prizePool"), value: prize ?? t("prizeTbd") },
    { label: t("teamCount"), value: view.teams.length ? String(view.teams.length) : tournament.teamCount ? String(tournament.teamCount) : null },
  ].filter((f) => f.value);
  const sections = [
    { id: "overview", label: t("sections.overview") },
    ...(leaderboard.length ? [{ id: "leaderboard", label: t("sections.leaderboard") }] : []),
    ...(view.teams.length ? [{ id: "teams", label: t("sections.teams") }] : []),
    ...(view.players.length ? [{ id: "players", label: t("sections.players") }] : []),
    { id: "matches", label: t("sections.matches") },
  ];

  return (
    <PageShell>
      <Link href="/tournaments" className={buttonClass("ghost", "sm", "-ml-3 mb-6")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={tournament.tier} />
        <FantasyBadge status={tournament.fantasyStatus} />
        {status === "live" ? <LiveBadge /> : null}
      </div>
      <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight font-bold text-balance md:text-5xl">{tournament.name}</h1>

      <nav aria-label={t("sections.overview")} className="sticky top-0 z-30 -mx-4 mt-6 border-b border-border bg-bg/95 px-4 backdrop-blur md:mx-0 md:px-0">
        <ul className="flex gap-1 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={buttonClass("ghost", "sm", "whitespace-nowrap")}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="overview" className="mt-8 grid scroll-mt-20 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <dl className="card grid gap-5 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="label">{fact.label}</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {tournament.format ? (
            <div className="card">
              <h2 className="label">{t("format")}</h2>
              <p className="mt-2 text-fg-muted">{tournament.format}</p>
            </div>
          ) : null}
        </div>

        <aside className="card grid content-start gap-4" aria-labelledby="fantasy-panel">
          <h2 id="fantasy-panel" className="font-display text-xl font-bold">
            {view.myTeam ? view.myTeam.name : t("fantasyPanelTitle")}
          </h2>
          {view.myTeam ? (
            <>
              <ul className="grid gap-1.5 text-sm">
                {view.myTeam.picks.map((p) => (
                  <li key={p.playerId} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[4px] bg-surface-2 px-3 py-2">
                    <span className="min-w-0">
                      <Link href={`/players/${p.slug}`} className="font-display font-semibold hover:underline">
                        {p.nickname}
                      </Link>{" "}
                      <span className="text-xs text-fg-muted">{p.teamTag}</span>
                      <span className="block text-xs text-accent">{p.role === "none" ? tRoles("none") : tRoles(`${p.role}.name`)}</span>
                    </span>
                    <span className="font-display font-bold tabular-nums">{pts(p.points)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="label">{t("total")}</span>
                <span className="font-display text-2xl font-bold tabular-nums">{pts(view.myTeam.total)}</span>
              </p>
            </>
          ) : (
            <p className="text-fg-muted">{t(PANEL_TEXT[panelStatus])}</p>
          )}
          {playable ? (
            <Link href={`/tournaments/${tournament.slug}/team`} className={buttonClass("primary", "md", "w-full")}>
              {view.editable ? (view.myTeam ? t("editTeam") : t("buildTeam")) : t("viewTeam")}
            </Link>
          ) : session ? null : (
            <Link href="/sign-up" className={buttonClass("primary", "md", "w-full")}>
              {tNav("signUp")}
            </Link>
          )}
          {view.myTeam ? (
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Check className="size-4 text-primary" aria-hidden="true" />
              {t("yourPlayer")}
            </p>
          ) : null}
        </aside>
      </div>

      {leaderboard.length ? (
        <section id="leaderboard" className="mt-14 scroll-mt-20" aria-labelledby="leaderboard-title">
          <h2 id="leaderboard-title" className="mb-4 font-display text-2xl font-bold">
            {t("sections.leaderboard")}
          </h2>
          <LeaderboardTable rows={leaderboard} me={session?.user.id ?? null} showTeam />
        </section>
      ) : null}

      {view.teams.length ? (
        <section id="teams" className="mt-14 scroll-mt-20" aria-labelledby="teams-title">
          <h2 id="teams-title" className="mb-4 font-display text-2xl font-bold">
            {t("teamsTitle")}
          </h2>
          <TeamsGrid teams={view.teams} />
        </section>
      ) : null}

      {view.players.length ? (
        <section id="players" className="mt-14 scroll-mt-20" aria-labelledby="players-title">
          <h2 id="players-title" className="font-display text-2xl font-bold">
            {t("playersTitle")}
          </h2>
          <p className="mt-1 mb-4 text-sm text-fg-muted">{t("playersIntro")}</p>
          <PlayersTable players={view.players} />
        </section>
      ) : null}

      <section id="matches" className="mt-14 scroll-mt-20" aria-labelledby="matches-title">
        <h2 id="matches-title" className="mb-4 font-display text-2xl font-bold">
          {t("matchesTitle")}
        </h2>
        <TournamentMatches matches={view.matches} />
      </section>

      <p className="mt-12 text-sm text-fg-subtle">{t("dataSource")}</p>
    </PageShell>
  );
}
