import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const t = await getTranslations("admin");
  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <span className="label mr-2 text-primary!">{t("title")}</span>
        <Link href="/admin" className={buttonClass("ghost", "sm")}>
          {t("tournaments")}
        </Link>
        <Link href="/admin/config" className={buttonClass("ghost", "sm")}>
          {t("config")}
        </Link>
      </div>
      {children}
    </PageShell>
  );
}
