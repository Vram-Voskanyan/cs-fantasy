import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { MobileNav } from "./mobile-nav";
import { buttonClass } from "./ui/button";

export async function SiteHeader() {
  const [t, session] = await Promise.all([getTranslations(), getSession()]);
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="font-display text-lg font-bold tracking-wide whitespace-nowrap">
            {t("app.name")}
          </Link>
          <nav aria-label={t("nav.menu")} className="flex items-center gap-2">
            <Link href="/tournaments" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
              {t("nav.tournaments")}
            </Link>
            {(session?.user as { role?: string } | undefined)?.role === "admin" ? (
              <Link href="/admin" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
                {t("nav.admin")}
              </Link>
            ) : null}
            {session ? (
              <Link href="/account" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
                {t("nav.account")}
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
                  {t("nav.signIn")}
                </Link>
                <Link href="/sign-up" className={buttonClass("primary", "sm")}>
                  {t("nav.signUp")}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <MobileNav signedIn={Boolean(session)} />
    </>
  );
}
