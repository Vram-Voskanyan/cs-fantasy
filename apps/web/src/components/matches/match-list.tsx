import { type Db, schema } from "@cs-vv-fantasy/db";
import { asc, eq, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { LiveBadge } from "@/components/tournaments/tournament-meta";

export async function MatchList({ db, tournamentId }: { db: Db; tournamentId: string }) {
  const [t, format] = await Promise.all([getTranslations("tournaments"), getFormatter()]);
  const matches = await db.select().from(schema.matches).where(eq(schema.matches.tournamentId, tournamentId)).orderBy(asc(schema.matches.startsAt));
  if (matches.length === 0) return <p className="text-fg-muted">{t("noMatches")}</p>;
  const teamIds = [...new Set(matches.flatMap((m) => [m.team1Id, m.team2Id]).filter((x): x is string => !!x))];
  const teams = new Map(
    (await db.select({ id: schema.teams.id, name: schema.teams.name }).from(schema.teams).where(inArray(schema.teams.id, teamIds))).map((x) => [x.id, x.name]),
  );
  const stages = [...new Set(matches.map((m) => m.stageName ?? ""))];

  return (
    <div className="grid gap-6">
      {stages.map((stage) => (
        <div key={stage} className="grid gap-2">
          {stage ? <h3 className="label">{stage}</h3> : null}
          <ul className="grid gap-2">
            {matches
              .filter((m) => (m.stageName ?? "") === stage)
              .map((m) => {
                const done = m.status === "completed" || m.status === "finished";
                const side = (teamId: string | null, score: number | null) => (
                  <span className={`flex items-center justify-between gap-3 ${done && m.winnerTeamId && m.winnerTeamId !== teamId ? "text-fg-muted" : ""}`}>
                    <span className="truncate">{teamId ? (teams.get(teamId) ?? t("tbd")) : t("tbd")}</span>
                    {done ? <span className="font-display font-bold tabular-nums">{score ?? "–"}</span> : null}
                  </span>
                );
                return (
                  <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[6px] border border-border bg-surface-1 px-4 py-3">
                    <div className="grid gap-1">
                      {side(m.team1Id, m.team1Score)}
                      {side(m.team2Id, m.team2Score)}
                    </div>
                    <div className="grid justify-items-end gap-1 text-sm text-fg-muted">
                      {m.status === "live" ? <LiveBadge /> : done ? <span>{t("final")}</span> : m.startsAt ? <span className="tabular-nums">{format.dateTime(m.startsAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
                      {m.bestOf ? <span>{t("bestOf", { n: m.bestOf })}</span> : null}
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
