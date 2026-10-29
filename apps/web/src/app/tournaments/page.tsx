import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { TournamentFilters } from "@/components/tournaments/tournament-filters";
import { TournamentGrid } from "@/components/tournaments/tournament-grid";
import { listTournaments, type TournamentFilter } from "@/lib/tournaments";

export async function generateMetadata() {
  const t = await getTranslations("tournaments");
  return { title: t("title") };
}

const STATUSES = ["all", "live", "upcoming", "finished"] as const;

export default async function TournamentsPage({ searchParams }: PageProps<"/tournaments">) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status) ?? "all";
  const filter: TournamentFilter = {
    status,
    tier: typeof params.tier === "string" && params.tier ? params.tier : null,
    fantasyOpen: params.fantasy === "open",
  };
  const now = new Date();
  const [t, { live, upcoming, finished }] = await Promise.all([getTranslations("tournaments"), listTournaments(filter, now)]);
  const sections = [
    { id: "live", title: t("liveTitle"), list: live },
    { id: "upcoming", title: t("upcomingTitle"), list: upcoming },
    { id: "finished", title: t("finishedTitle"), list: finished },
  ].filter((s) => s.list.length > 0);

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">{t("intro")}</p>
      <TournamentFilters value={filter} />

      {sections.length === 0 ? <p className="card mt-10 text-fg-muted">{t("noResults")}</p> : null}
      {sections.map((s) => (
        <section key={s.id} className="mt-12" aria-labelledby={`t-${s.id}`}>
          <h2 id={`t-${s.id}`} className="mb-5 font-display text-2xl font-bold">
            {s.title} <span className="font-sans text-base font-normal text-fg-muted">{s.list.length}</span>
          </h2>
          <TournamentGrid tournaments={s.list} now={now} />
        </section>
      ))}

      <p className="mt-12 text-sm text-fg-subtle">{t("dataSource")}</p>
    </PageShell>
  );
}
