import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("app");
  return (
    <footer className="mt-auto border-t border-border pb-14 sm:pb-0">
      <div className="mx-auto max-w-[1280px] px-4 py-6 text-sm text-fg-subtle md:px-6">{t("notAffiliated")}</div>
    </footer>
  );
}
