import { Check } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ViewPlayer } from "@/lib/tournament-view";

export async function PlayersTable({ players }: { players: ViewPlayer[] }) {
  const [t, tRoles, format] = await Promise.all([getTranslations("tournaments"), getTranslations("roles"), getFormatter()]);
  if (players.length === 0) return <p className="card text-fg-muted">{t("noPlayers")}</p>;
  const credits = (n: number) => format.number(n / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="overflow-x-auto rounded-[6px] border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-1">
          <tr className="label text-left">
            <th className="px-3 py-2.5 text-right">{t("colRank")}</th>
            <th className="px-3 py-2.5">{t("colPlayer")}</th>
            <th className="px-3 py-2.5">{t("colTeam")}</th>
            <th className="px-3 py-2.5">{t("colRole")}</th>
            <th className="px-3 py-2.5 text-right">{t("colRating")}</th>
            <th className="px-3 py-2.5 text-right">{t("colPrice")}</th>
            <th className="px-3 py-2.5 text-right">{t("colMaps")}</th>
            <th className="px-3 py-2.5 text-right">{t("colPoints")}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className={`border-t border-border tabular-nums ${p.myRole ? "bg-primary-tint" : "bg-surface-1/40"}`}>
              <td className="px-3 py-2 text-right text-fg-muted">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <Link href={`/players/${p.slug}`} className="font-medium hover:underline">
                    {p.nickname}
                  </Link>
                  {p.myRole ? <Check className="size-4 text-primary" aria-label={t("yourPlayer")} /> : null}
                  {p.myRole && p.myRole !== "none" ? <span className="text-xs text-accent">{tRoles(`${p.myRole}.name`)}</span> : null}
                </span>
              </td>
              <td className="px-3 py-2 text-fg-muted">
                <Link href={`/teams/${p.teamSlug}`} className="hover:underline">
                  {p.teamTag}
                </Link>
              </td>
              <td className="px-3 py-2 text-fg-muted">{p.citoRole ?? "–"}</td>
              <td className="px-3 py-2 text-right">{p.rating !== null ? format.number(p.rating, { minimumFractionDigits: 2 }) : "–"}</td>
              <td className="px-3 py-2 text-right">{p.price !== null ? credits(p.price) : "–"}</td>
              <td className="px-3 py-2 text-right text-fg-muted">{p.maps}</td>
              <td className="px-3 py-2 text-right font-display font-bold">{format.number(p.points, { maximumFractionDigits: 1 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
