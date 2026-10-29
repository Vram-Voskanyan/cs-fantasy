import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { TournamentGrid } from "@/components/tournaments/tournament-grid";
import { listCurrentTournaments } from "@/lib/tournaments";

export async function generateMetadata() {
  const t = await getTranslations("tournaments");
  return { title: t("title") };
}

export default async function TournamentsPage() {
  const now = new Date();
  const [t, { live, upcoming }] = await Promise.all([getTranslations("tournaments"), listCurrentTournaments(now)]);

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">{t("intro")}</p>

      {live.length === 0 && upcoming.length === 0 ? <p className="card mt-10 text-fg-muted">{t("empty")}</p> : null}

      {live.length > 0 ? (
        <section className="mt-12" aria-labelledby="t-live">
          <h2 id="t-live" className="mb-5 font-display text-2xl font-bold">
            {t("liveTitle")}
          </h2>
          <TournamentGrid tournaments={live} now={now} />
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-12" aria-labelledby="t-upcoming">
          <h2 id="t-upcoming" className="mb-5 font-display text-2xl font-bold">
            {t("upcomingTitle")}
          </h2>
          <TournamentGrid tournaments={upcoming} now={now} />
        </section>
      ) : null}

      <p className="mt-12 text-sm text-fg-subtle">{t("dataSource")}</p>
    </PageShell>
  );
}
