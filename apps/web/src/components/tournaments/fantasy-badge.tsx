import { getTranslations } from "next-intl/server";
import type { Tournament } from "@/lib/tournaments";

const KEYS = {
  none: "fantasyNone",
  announced: "fantasyAnnounced",
  open: "fantasyOpen",
  locked: "fantasyLocked",
  finished: "fantasyFinished",
} as const;

export async function FantasyBadge({ status }: { status: Tournament["fantasyStatus"] }) {
  if (status === "none") return null;
  const t = await getTranslations("tournaments");
  return <span className="badge badge-fantasy">{t(KEYS[status])}</span>;
}
