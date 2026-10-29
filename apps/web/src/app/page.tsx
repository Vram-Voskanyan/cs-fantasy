import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const [t, session] = await Promise.all([getTranslations("home"), getSession()]);
  return (
    <PageShell>
      <section className="max-w-2xl">
        <p className="label text-primary!">{t("kicker")}</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold md:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-fg-muted">{(await getTranslations("app"))("tagline")}</p>
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
        <div className="card mt-10">
          <p className="text-fg-muted">
            {session ? t("welcomeBack", { name: session.user.name }) : t("comingSoon")}
          </p>
        </div>
      </section>
    </PageShell>
  );
}
