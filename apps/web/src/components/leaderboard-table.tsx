import { getFormatter, getTranslations } from "next-intl/server";
import type { LeaderboardRow } from "@/lib/leaderboard";

const SHOWN = 25;

/** Ranked fantasy players. The current user's row is highlighted and always shown. */
export async function LeaderboardTable({
  rows,
  me,
  showTeam,
  showTournaments,
  limit,
}: {
  rows: LeaderboardRow[];
  me: string | null;
  showTeam?: boolean;
  showTournaments?: boolean;
  // Compact mode: only the top rows plus the user's row, no "show all".
  limit?: number;
}) {
  const [t, format] = await Promise.all([getTranslations("leaderboard"), getFormatter()]);
  if (rows.length === 0) return <p className="card text-fg-muted">{t("empty")}</p>;
  const shown = limit ?? SHOWN;
  const top = rows.slice(0, shown);
  const mine = rows.find((r) => r.userId === me);
  const rest = limit ? [] : rows.slice(shown);

  const row = (r: LeaderboardRow) => (
    <tr key={`${r.userId}-${r.teamName ?? ""}`} className={`border-t border-border tabular-nums ${r.userId === me ? "bg-primary-tint" : ""}`}>
      <td className="px-3 py-2.5 text-right font-display font-bold">{r.rank}</td>
      <td className="px-3 py-2.5">
        <span className="font-medium">{r.userName}</span>
        {r.userId === me ? <span className="ml-2 badge badge-tier-s">{t("you")}</span> : null}
      </td>
      {showTeam ? <td className="px-3 py-2.5 text-fg-muted">{r.teamName}</td> : null}
      {showTournaments ? <td className="px-3 py-2.5 text-right text-fg-muted">{r.tournaments}</td> : null}
      <td className="px-3 py-2.5 text-right font-display text-base font-bold">{format.number(r.points, { maximumFractionDigits: 2 })}</td>
    </tr>
  );
  const head = (
    <thead className="bg-surface-1">
      <tr className="label text-left">
        <th className="w-14 px-3 py-2.5 text-right">{t("rank")}</th>
        <th className="px-3 py-2.5">{t("player")}</th>
        {showTeam ? <th className="px-3 py-2.5">{t("team")}</th> : null}
        {showTournaments ? <th className="px-3 py-2.5 text-right">{t("tournaments")}</th> : null}
        <th className="px-3 py-2.5 text-right">{t("points")}</th>
      </tr>
    </thead>
  );

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-[6px] border border-border">
        <table className="w-full min-w-[420px] text-sm">
          {head}
          <tbody>
            {top.map(row)}
            {mine && !top.includes(mine) ? row(mine) : null}
          </tbody>
        </table>
      </div>
      {rest.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg">{t("showAll", { count: rows.length })}</summary>
          <div className="mt-3 overflow-x-auto rounded-[6px] border border-border">
            <table className="w-full min-w-[420px] text-sm">
              {head}
              <tbody>{rest.map(row)}</tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
