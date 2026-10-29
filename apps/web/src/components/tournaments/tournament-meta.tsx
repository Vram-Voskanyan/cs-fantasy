import { getFormatter, getTranslations } from "next-intl/server";
import type { Tournament } from "@/lib/tournaments";

export async function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const t = await getTranslations("tournaments");
  return <span className={tier === "S" ? "badge badge-tier-s" : "badge"}>{t("tier", { tier })}</span>;
}

export async function LiveBadge() {
  const t = await getTranslations("tournaments");
  return (
    <span className="live">
      <span className="live-dot" aria-hidden="true" />
      {t("live")}
    </span>
  );
}

export async function formatDates(t: Tournament) {
  const format = await getFormatter();
  if (!t.startsAt) return null;
  if (!t.endsAt) return format.dateTime(t.startsAt, { day: "numeric", month: "short", year: "numeric" });
  return format.dateTimeRange(t.startsAt, t.endsAt, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function formatPrize(t: Tournament) {
  if (!t.prizePool) return null;
  const format = await getFormatter();
  return format.number(t.prizePool, {
    style: "currency",
    currency: t.currency ?? "USD",
    notation: t.prizePool >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: t.prizePool >= 100_000 ? 2 : 0,
  });
}
