import { schema } from "@cs-vv-fantasy/db";
import { inArray } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PageShell } from "@/components/page-shell";
import { getDb } from "@/lib/db";
import { overallLeaderboard } from "@/lib/leaderboard";
import { getSession } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("leaderboard");
  return { title: t("title") };
}

export default async function LeaderboardPage() {
  const db = await getDb();
  const [t, session, rows, tournaments] = await Promise.all([
    getTranslations("leaderboard"),
    getSession(),
    overallLeaderboard(db),
    db
      .select({ name: schema.tournaments.name, slug: schema.tournaments.slug })
      .from(schema.tournaments)
      .where(inArray(schema.tournaments.fantasyStatus, ["open", "locked", "finished"])),
  ]);

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 mb-8 max-w-2xl text-fg-muted">{t("intro")}</p>
      <LeaderboardTable rows={rows} me={session?.user.id ?? null} showTournaments />
      {tournaments.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold">{t("byTournament")}</h2>
          <ul className="flex flex-wrap gap-2">
            {tournaments.map((x) => (
              <li key={x.slug}>
                <Link href={`/tournaments/${x.slug}#leaderboard`} className="badge h-9! px-3! hover:bg-surface-2">
                  {x.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
