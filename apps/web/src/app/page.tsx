import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeroArt } from "@/components/hero-art";
import { HeroTracers } from "@/components/hero-tracers";
import { PageShell } from "@/components/page-shell";
import { TournamentGrid } from "@/components/tournaments/tournament-grid";
import { buttonClass } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { isFeatured, listCurrentTournaments } from "@/lib/tournaments";

const UPCOMING_ON_HOME = 6;

export default async function HomePage() {
  const now = new Date();
  const [t, tApp, session, current] = await Promise.all([
    getTranslations("home"),
    getTranslations("app"),
    getSession(),
    listCurrentTournaments(now),
  ]);
  const live = current.live.filter(isFeatured);
  const upcoming = current.upcoming.filter(isFeatured).slice(0, UPCOMING_ON_HOME);

  return (
    <PageShell>
      <section className="relative -mx-4 -mt-10 overflow-hidden px-4 pt-10 pb-6 md:-mx-6 md:-mt-16 md:px-6 md:pt-16">
        <HeroTracers />
        <div className="relative grid items-center gap-10 md:grid-cols-[1fr_minmax(0,360px)] lg:grid-cols-[1fr_440px]">
        <div className="max-w-2xl">
        <p className="label text-primary!">{t("kicker")}</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold md:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-fg-muted">{tApp("tagline")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {session ? (
            <Link href="/account" className={buttonClass("primary", "lg")}>
              {t("ctaAccount")}
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className={buttonClass("primary", "lg")}>
                {t("ctaSignUp")}
              </Link>
              <Link href="/sign-in" className={buttonClass("secondary", "lg")}>
                {t("ctaSignIn")}
              </Link>
            </>
          )}
        </div>
        </div>
        <div className="hidden md:block">
          <HeroArt />
        </div>
        </div>
      </section>

      {live.length > 0 ? (
        <section className="mt-16" aria-labelledby="home-live">
          <h2 id="home-live" className="mb-5 font-display text-2xl font-bold md:text-3xl">
            {t("liveTitle")}
          </h2>
          <TournamentGrid tournaments={live} now={now} />
        </section>
      ) : null}

      <section className="mt-16" aria-labelledby="home-upcoming">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 id="home-upcoming" className="font-display text-2xl font-bold md:text-3xl">
            {t("upcomingTitle")}
          </h2>
          <Link href="/tournaments" className={buttonClass("ghost", "sm")}>
            {t("allTournaments")}
          </Link>
        </div>
        {upcoming.length > 0 ? (
          <TournamentGrid tournaments={upcoming} now={now} />
        ) : (
          <p className="card text-fg-muted">{t("empty")}</p>
        )}
      </section>
    </PageShell>
  );
}
