import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { buttonClass } from "./ui/button";

export async function SiteHeader() {
  const [t, session] = await Promise.all([getTranslations(), getSession()]);
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="font-display text-lg font-bold tracking-wide">
          {t("app.name")}
        </Link>
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href="/account" className={buttonClass("ghost", "sm")}>
              {t("nav.account")}
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={buttonClass("ghost", "sm")}>
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
  );
}
