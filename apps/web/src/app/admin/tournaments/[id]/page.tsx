import { schema } from "@cs-vv-fantasy/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildPool, clearData, fillFake, loadCitoMatches, loadCitoStats, loadCitoTeams, rescore, simulateMatches, syncRanks } from "@/app/admin/actions";
import { AddTeamForm } from "@/components/admin/add-team-form";
import { ActionButton } from "@/components/admin/action-button";
import { PoolEditor } from "@/components/admin/pool-editor";
import { StagesEditor } from "@/components/admin/stages-editor";
import { StatusSelect } from "@/components/admin/status-select";
import { buttonClass } from "@/components/ui/button";
import { getGameConfig, getStages } from "@/jobs/game";
import { getDb } from "@/lib/db";

export default async function AdminTournamentPage({ params }: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id)).limit(1);
  if (!tournament) notFound();
  const [t, stages, active, pool] = await Promise.all([
    getTranslations("admin"),
    getStages(db, id),
    getGameConfig(db, id),
    db
      .select({
        playerId: schema.poolPlayers.playerId,
        nickname: schema.players.nickname,
        teamName: schema.teams.name,
        rating: schema.players.rating,
        price: schema.poolPlayers.price,
        isAvailable: schema.poolPlayers.isAvailable,
      })
      .from(schema.poolPlayers)
      .innerJoin(schema.players, eq(schema.players.id, schema.poolPlayers.playerId))
      .innerJoin(schema.teams, eq(schema.teams.id, schema.poolPlayers.teamId))
      .where(eq(schema.poolPlayers.tournamentId, id))
      .orderBy(asc(schema.teams.name), asc(schema.players.nickname)),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <Link href={`/tournaments/${tournament.slug}`} className="font-display text-2xl font-bold hover:underline md:text-3xl">
          {tournament.name}
        </Link>
        <p className="mt-1 text-sm text-fg-muted">
          {tournament.dataSource === "cito" ? t("dataCito") : tournament.dataSource === "fake" ? t("dataFake") : t("dataNone")}
        </p>
      </div>

      <section className="card grid gap-4">
        <StatusSelect tournamentId={id} value={tournament.fantasyStatus} />
      </section>

      <section className="card grid gap-3">
        <h2 className="font-display text-xl font-bold">{t("stages")}</h2>
        <p className="text-sm text-fg-muted">{t("stagesHint")}</p>
        <StagesEditor
          key={stages.map((s) => `${s.id}:${s.lockAt.getTime()}`).join("|")}
          tournamentId={id}
          initial={stages.map((s) => ({ id: s.id, name: s.name, lockAt: s.lockAt.toISOString() }))}
        />
      </section>

      <section className="card grid gap-4">
        <h2 className="font-display text-xl font-bold">{t("data")}</h2>
        <p className="text-sm text-fg-muted">{t("dataHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionButton action={loadCitoTeams.bind(null, id)} label={t("loadTeams")} />
          <ActionButton action={loadCitoMatches.bind(null, id)} label={t("loadMatches")} />
          <ActionButton action={syncRanks.bind(null, id)} label={t("syncRanks")} />
          <ActionButton action={loadCitoStats.bind(null, id)} label={t("loadStats", { max: 5 })} />
          <ActionButton action={fillFake.bind(null, id)} label={t("fillFake")} />
          <ActionButton action={simulateMatches.bind(null, id, 1)} label={t("simulateNext")} />
          <ActionButton action={simulateMatches.bind(null, id, 5)} label={t("simulateFive")} />
          <ActionButton action={rescore.bind(null, id)} label={t("rescore")} />
          <ActionButton action={clearData.bind(null, id)} label={t("clearData")} confirmLabel={t("clearConfirm")} variant="danger" />
        </div>
        <AddTeamForm tournamentId={id} />
      </section>

      <section className="card grid gap-4">
        <h2 className="font-display text-xl font-bold">{t("pool")}</h2>
        <p className="text-sm text-fg-muted">{t("poolHint")}</p>
        <div className="flex flex-wrap gap-4">
          <ActionButton action={buildPool.bind(null, id, false)} label={t("buildPool")} variant="primary" />
          <ActionButton action={buildPool.bind(null, id, true)} label={t("repriceAll")} />
        </div>
        {pool.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("emptyPool")}</p>
        ) : (
          <PoolEditor
            key={pool.map((r) => `${r.playerId}:${r.price}:${r.isAvailable}`).join("|")}
            tournamentId={id}
            rows={pool}
            step={active.config.pricing.step}
          />
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {t("configFor", { scope: active.scope === "default" ? t("configDefault") : tournament.name })} · {t("configVersion", { version: active.version })}
        </p>
        <Link href={`/admin/config?scope=${id}`} className={buttonClass("secondary", "sm")}>
          {t("configTournament")}
        </Link>
      </section>
    </div>
  );
}
