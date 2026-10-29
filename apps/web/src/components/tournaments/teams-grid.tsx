import { Check } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ViewTeam } from "@/lib/tournament-view";

export async function TeamsGrid({ teams }: { teams: ViewTeam[] }) {
  const [t, tRoles, format] = await Promise.all([getTranslations("tournaments"), getTranslations("roles"), getFormatter()]);
  if (teams.length === 0) return <p className="card text-fg-muted">{t("noTeams")}</p>;
  const credits = (n: number) => format.number(n / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pts = (n: number) => format.number(n, { maximumFractionDigits: 1 });

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => (
        <li key={team.id} className="card grid content-start gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold">
                <Link href={`/teams/${team.slug}`} className="hover:underline">
                  {team.name}
                </Link>
              </h3>
              {team.countryName ? <p className="text-sm text-fg-muted">{team.countryName}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {team.vrsRanking ? <span className="badge badge-tier-s">{t("vrs", { rank: team.vrsRanking })}</span> : null}
              {team.worldRanking ? <span className="badge">{t("world", { rank: team.worldRanking })}</span> : null}
            </div>
          </div>
          <ul className="grid gap-1 text-sm">
            {team.players.map((p) => (
              <li
                key={p.id}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[4px] px-2 py-1.5 ${p.myRole ? "bg-primary-tint" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Link href={`/players/${p.slug}`} className="truncate font-medium hover:underline">
                    {p.nickname}
                  </Link>
                  {p.myRole ? <Check className="size-4 shrink-0 text-primary" aria-label={t("yourPlayer")} /> : null}
                  <span className="truncate text-xs text-fg-muted">
                    {p.myRole && p.myRole !== "none" ? <span className="text-accent">{tRoles(`${p.myRole}.name`)}</span> : p.citoRole}
                    {p.rating !== null ? ` · ${format.number(p.rating, { minimumFractionDigits: 2 })}` : ""}
                  </span>
                </span>
                <span className="tabular-nums text-fg-muted">{p.price !== null ? credits(p.price) : "–"}</span>
                <span className="w-12 text-right font-display font-bold tabular-nums">{pts(p.points)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
