import { type Db, schema } from "@cs-vv-fantasy/db";
import type { RoleId } from "@cs-vv-fantasy/scoring";
import { inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { loadScoringData, picksForStage, playerStagePoints } from "@/jobs/score";

type Pick = { playerId: string; role: string | null; stageId: string };

/** Per stage: each picked player's points per match, with the map breakdown. */
export async function TeamPoints({ db, tournamentId, picks }: { db: Db; tournamentId: string; picks: Pick[] }) {
  const [t, format, data] = await Promise.all([getTranslations(), getFormatter(), loadScoringData(db, tournamentId)]);
  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  const players = playerIds.length
    ? new Map(
        (await db.select({ id: schema.players.id, nickname: schema.players.nickname }).from(schema.players).where(inArray(schema.players.id, playerIds))).map(
          (p) => [p.id, p.nickname],
        ),
      )
    : new Map<string, string>();
  const teams = new Map(
    (
      await db
        .select({ id: schema.teams.id, tag: schema.teams.tag, name: schema.teams.name })
        .from(schema.teams)
        .where(inArray(schema.teams.id, [...new Set(data.matches.flatMap((m) => [m.team1Id, m.team2Id]).filter((x): x is string => !!x))]))
    ).map((x) => [x.id, x.tag ?? x.name]),
  );
  const pts = (n: number) => format.number(n, { maximumFractionDigits: 2 });
  const now = new Date();
  const stages = data.stages.filter((s) => s.lockAt <= now);

  if (stages.length === 0 || data.points.length === 0) {
    return <p className="card text-fg-muted">{t("builder.noPoints")}</p>;
  }

  return (
    <div className="grid gap-6">
      {stages.map((stage) => {
        const rows = picksForStage(data.stages, picks, stage).map((p) => {
          const matches = playerStagePoints(data, stage, p.playerId, (p.role as RoleId | null) ?? null);
          return { pick: p, matches, total: matches.reduce((s, m) => s + m.points, 0) };
        });
        const total = rows.reduce((s, r) => s + r.total, 0);
        return (
          <section key={stage.id} className="card grid gap-3">
            <h3 className="font-display text-lg font-bold">{t("builder.stagePoints", { stage: stage.name, points: pts(total) })}</h3>
            <ul className="grid gap-2">
              {rows.map(({ pick, matches, total: playerTotal }) => (
                <li key={pick.playerId} className="rounded-[6px] border border-border">
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
                      <span>
                        <span className="font-display font-semibold">{players.get(pick.playerId)}</span>{" "}
                        <span className="text-sm text-accent">{pick.role ? t(`roles.${pick.role as RoleId}.name`) : t("roles.none")}</span>
                      </span>
                      <span className="font-display font-bold tabular-nums">{pts(playerTotal)}</span>
                    </summary>
                    <div className="grid gap-3 border-t border-border p-3 text-sm">
                      {matches.length === 0 ? <p className="text-fg-muted">{t("builder.noPoints")}</p> : null}
                      {matches.map((m) => {
                        const match = data.matches.find((x) => x.id === m.matchId)!;
                        return (
                          <div key={m.matchId} className="grid gap-1">
                            <p className="flex justify-between gap-2">
                              <span className="text-fg-muted">
                                {teams.get(match.team1Id ?? "") ?? t("tournaments.tbd")} {t("tournaments.vs")} {teams.get(match.team2Id ?? "") ?? t("tournaments.tbd")}
                              </span>
                              <span className="tabular-nums">{t("builder.matchPoints", { points: pts(m.points) })}</span>
                            </p>
                            <ul className="grid gap-1 pl-3 text-fg-muted">
                              {m.maps.map((map) => (
                                <li key={map.mapId}>
                                  {t("builder.map", { n: map.mapNumber })}
                                  {map.mapName ? ` · ${map.mapName}` : ""}: {map.breakdown.map((b) => `${t(`breakdown.${b.key}` as "breakdown.kills")} ${b.count ?? ""} ${b.points > 0 ? "+" : ""}${pts(b.points)}`).join(", ")}
                                  {map.roleBonus ? ` · ${t("builder.roleBonus")} ${map.roleBonus > 0 ? "+" : ""}${pts(map.roleBonus)}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
