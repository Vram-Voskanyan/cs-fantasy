import { schema } from "@cs-vv-fantasy/db";
import { asc, desc, ne } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatDates, TierBadge } from "@/components/tournaments/tournament-meta";
import { getDb } from "@/lib/db";

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.tournaments)
    .where(ne(schema.tournaments.status, "finished"))
    .orderBy(desc(schema.tournaments.fantasyStatus), asc(schema.tournaments.startsAt));
  const dates = new Map(await Promise.all(rows.map(async (r) => [r.id, await formatDates(r)] as const)));
  const groups = [rows.filter((r) => r.fantasyStatus !== "none"), rows.filter((r) => r.fantasyStatus === "none")];

  return (
    <div className="grid gap-10">
      {groups.map((list, i) =>
        list.length === 0 ? null : (
          <ul key={i} className="grid gap-2">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/tournaments/${r.id}`} className="card card-link flex flex-wrap items-center justify-between gap-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <TierBadge tier={r.tier} />
                    <span className="font-display font-semibold">{r.name}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                    <span className="tabular-nums">{dates.get(r.id)}</span>
                    <span className="badge">{t(`status.${r.fantasyStatus}`)}</span>
                    <span>{r.dataSource === "cito" ? t("dataCito") : r.dataSource === "fake" ? t("dataFake") : t("dataNone")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
