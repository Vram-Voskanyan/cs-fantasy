import { schema } from "@cs-vv-fantasy/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageShell } from "@/components/page-shell";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const [t, format, db] = await Promise.all([getTranslations("account"), getFormatter(), getDb()]);
  const { user } = session;
  const teams = await db
    .select({
      id: schema.fantasyTeams.id,
      name: schema.fantasyTeams.name,
      tournament: schema.tournaments.name,
      slug: schema.tournaments.slug,
      points: schema.fantasyTeamScores.points,
    })
    .from(schema.fantasyTeams)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.fantasyTeams.tournamentId))
    .leftJoin(schema.fantasyTeamScores, eq(schema.fantasyTeamScores.fantasyTeamId, schema.fantasyTeams.id))
    .where(eq(schema.fantasyTeams.userId, user.id))
    .orderBy(desc(schema.fantasyTeams.createdAt));
  const totals = new Map<string, { name: string; tournament: string; slug: string; points: number }>();
  for (const r of teams) {
    const prev = totals.get(r.id);
    totals.set(r.id, { name: r.name, tournament: r.tournament, slug: r.slug, points: (prev?.points ?? 0) + (r.points ?? 0) });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-3xl font-bold">{t("title")}</h1>
        <div className="card grid gap-4">
          <div>
            <p className="label">{t("name")}</p>
            <p className="font-display text-xl font-semibold">{user.name}</p>
          </div>
          <div>
            <p className="label">{t("email")}</p>
            <p>{user.email}</p>
          </div>
          <div>
            <p className="label">{t("memberSince")}</p>
            <p>{format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}</p>
          </div>
          <div className="pt-2">
            <SignOutButton />
          </div>
        </div>

        <h2 className="mt-10 mb-4 font-display text-2xl font-bold">{t("myTeams")}</h2>
        {totals.size === 0 ? (
          <p className="card text-fg-muted">{t("noTeams")}</p>
        ) : (
          <ul className="grid gap-2">
            {[...totals.entries()].map(([id, team]) => (
              <li key={id}>
                <Link href={`/tournaments/${team.slug}/team`} className="card card-link flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-display font-semibold">{team.name}</span>
                    <span className="text-sm text-fg-muted">{team.tournament}</span>
                  </span>
                  <span className="font-display text-lg font-bold tabular-nums">
                    {t("points", { points: format.number(Math.round(team.points * 100) / 100) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
