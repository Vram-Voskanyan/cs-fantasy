"use client";

import { House, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Bottom navigation on phones (docs/DESIGN.md section 9). Hidden from the "sm" breakpoint up.
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [
    { href: "/", label: t("home"), icon: House, active: pathname === "/" },
    { href: "/tournaments", label: t("tournaments"), icon: Trophy, active: pathname.startsWith("/tournaments") },
    signedIn
      ? { href: "/account", label: t("account"), icon: UserRound, active: pathname.startsWith("/account") }
      : { href: "/sign-in", label: t("signIn"), icon: UserRound, active: pathname === "/sign-in" || pathname === "/sign-up" },
  ];

  return (
    <nav
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-3">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-primary" : "text-fg-muted"}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
