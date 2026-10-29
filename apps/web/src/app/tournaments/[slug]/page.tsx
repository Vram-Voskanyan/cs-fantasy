import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FantasyBadge } from "@/components/tournaments/fantasy-badge";
import { formatDates, formatPrize, LiveBadge, TierBadge } from "@/components/tournaments/tournament-meta";
import { buttonClass } from "@/components/ui/button";
import { MatchList } from "@/components/matches/match-list";
import { getDb } from "@/lib/db";
import { loadGame } from "@/lib/fantasy";
import { getSession } from "@/lib/session";
import { getTournamentBySlug, liveStatus } from "@/lib/tournaments";

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
  const [t, tNav, session, dates, prize] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("nav"),
    getSession(),
    formatDates(tournament),
    formatPrize(tournament),
  ]);
  const status = liveStatus(tournament, now);
  const db = await getDb();
  const game = tournament.fantasyStatus === "none" ? null : await loadGame(db, tournament, session?.user.id ?? null, now);
  const mine = game?.mine ?? null;
  const editable = !!game?.editableStage;
  const playable = ["open", "locked", "finished"].includes(tournament.fantasyStatus) && !!session;
  // "open" with every stage already locked plays like "locked".
  const panelStatus = tournament.fantasyStatus === "open" && !editable ? "locked" : tournament.fantasyStatus;
  const facts = [
    { label: t("dates"), value: dates },
    { label: t("location"), value: [tournament.location, tournament.isLan === null ? null : tournament.isLan ? t("lan") : t("online")].filter(Boolean).join(" · ") },
    { label: t("prizePool"), value: prize ?? t("prizeTbd") },
    { label: t("teamCount"), value: tournament.teamCount ? String(tournament.teamCount) : null },
  ].filter((f) => f.value);

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

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
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

        <aside className="card content-start" aria-labelledby="fantasy-panel">
          <h2 id="fantasy-panel" className="font-display text-xl font-bold">
            {t("fantasyPanelTitle")}
          </h2>
          <p className="mt-3 text-fg-muted">{t(PANEL_TEXT[panelStatus])}</p>
          {mine ? (
            <p className="mt-3 font-display text-lg font-bold tabular-nums">
              {mine.team.name} · {t("yourPoints", { points: mine.total })}
            </p>
          ) : null}
          {playable ? (
            <Link href={`/tournaments/${tournament.slug}/team`} className={buttonClass("primary", "md", "mt-6 w-full")}>
              {editable ? (mine ? t("editTeam") : t("buildTeam")) : t("viewTeam")}
            </Link>
          ) : session ? null : (
            <Link href="/sign-up" className={buttonClass("primary", "md", "mt-6 w-full")}>
              {tNav("signUp")}
            </Link>
          )}
        </aside>
      </div>

      <section className="mt-12" aria-labelledby="matches-title">
        <h2 id="matches-title" className="mb-4 font-display text-2xl font-bold">
          {t("matchesTitle")}
        </h2>
        <MatchList db={db} tournamentId={tournament.id} />
      </section>

      <p className="mt-12 text-sm text-fg-subtle">{t("dataSource")}</p>
    </PageShell>
  );
}
