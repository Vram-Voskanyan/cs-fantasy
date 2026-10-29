import { type GameConfig, type RoleId } from "@cs-vv-fantasy/scoring";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { TeamBuilder } from "@/components/team/team-builder";
import { TeamPoints } from "@/components/team/team-points";
import { buttonClass } from "@/components/ui/button";
import { picksForStage } from "@/jobs/score";
import { getDb } from "@/lib/db";
import { loadGame, loadPool } from "@/lib/fantasy";
import { getSession } from "@/lib/session";
import { getTournamentBySlug } from "@/lib/tournaments";

function roleParams(config: GameConfig, role: RoleId): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(config.roles[role])) {
    if (k === "enabled") continue;
    if (typeof v === "number") params[k] = v;
    if (typeof v === "boolean") params[k === "refundOpeningDeaths" ? "refund" : k] = String(v);
  }
  return params;
}

export default async function TeamPage({ params }: PageProps<"/tournaments/[slug]/team">) {
  const tournament = await getTournamentBySlug((await params).slug);
  if (!tournament) notFound();
  const [t, session] = await Promise.all([getTranslations(), getSession()]);
  const db = await getDb();

  const header = (
    <>
      <Link href={`/tournaments/${tournament.slug}`} className={buttonClass("ghost", "sm", "-ml-3 mb-6")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {tournament.name}
      </Link>
      <h1 className="mb-8 font-display text-3xl font-bold md:text-4xl">{t("builder.title")}</h1>
    </>
  );

  if (!["open", "locked", "finished"].includes(tournament.fantasyStatus)) {
    return (
      <PageShell>
        {header}
        <p className="card text-fg-muted">{t("builder.closed")}</p>
      </PageShell>
    );
  }
  if (!session) {
    return (
      <PageShell>
        {header}
        <div className="card grid justify-items-start gap-4">
          <p className="text-fg-muted">{t("builder.signInToPlay")}</p>
          <Link href="/sign-in" className={buttonClass("primary")}>
            {t("nav.signIn")}
          </Link>
        </div>
      </PageShell>
    );
  }

  const game = await loadGame(db, tournament, session.user.id);
  const picks = game.mine?.picks ?? [];
  const pool = game.editableStage ? await loadPool(db, tournament.id) : [];
  const initialPicks = game.editableStage
    ? picksForStage(game.stages, picks, game.editableStage).map((p) => ({ playerId: p.playerId, role: (p.role as RoleId | null) ?? null }))
    : [];

  return (
    <PageShell>
      {header}
      {game.editableStage ? (
        pool.length === 0 ? (
          <p className="card text-fg-muted">{t("builder.noPool")}</p>
        ) : (
          <TeamBuilder
            tournamentId={tournament.id}
            stageName={game.editableStage.name}
            lockAt={game.editableStage.lockAt.toISOString()}
            size={game.config.roster.size}
            budget={game.config.roster.budget}
            maxPerTeam={game.config.roster.maxPerTeam}
            uniqueRoles={game.config.roster.uniqueRoles}
            roles={game.roles.map((id) => ({ id, params: roleParams(game.config, id) }))}
            pool={pool}
            initialName={game.mine?.team.name ?? session.user.name}
            initialPicks={initialPicks}
          />
        )
      ) : null}

      {game.mine ? (
        <section className="mt-12" aria-labelledby="points-title">
          <h2 id="points-title" className="mb-4 font-display text-2xl font-bold">
            {t("builder.pointsTitle")}
          </h2>
          <TeamPoints db={db} tournamentId={tournament.id} picks={picks} />
        </section>
      ) : null}
    </PageShell>
  );
}
