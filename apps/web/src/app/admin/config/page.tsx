import { schema } from "@cs-vv-fantasy/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { activateConfigVersion } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { ConfigEditor } from "@/components/admin/config-editor";
import { buttonClass } from "@/components/ui/button";
import { getGameConfig, listConfigVersions } from "@/jobs/game";
import { getDb } from "@/lib/db";

export default async function AdminConfigPage({ searchParams }: PageProps<"/admin/config">) {
  const scopeParam = (await searchParams).scope;
  const scope = typeof scopeParam === "string" && scopeParam ? scopeParam : "default";
  const db = await getDb();
  const [t, format, active, versions] = await Promise.all([
    getTranslations("admin"),
    getFormatter(),
    getGameConfig(db, scope === "default" ? null : scope),
    listConfigVersions(db, scope),
  ]);
  const tournament =
    scope === "default" ? null : (await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, scope)).limit(1))[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {t("configFor", { scope: tournament ? tournament.name : t("configDefault") })}
        </h1>
        {tournament ? (
          <Link href="/admin/config" className={buttonClass("ghost", "sm")}>
            {t("editDefault")}
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-fg-muted">{t("configVersion", { version: active.scope === scope ? active.version : 0 })}</p>

      <ConfigEditor key={`${scope}-${active.version}`} scope={scope} initial={active.config} />

      {versions.length > 0 ? (
        <section className="card grid gap-3">
          <h2 className="font-display text-xl font-bold">{t("versions")}</h2>
          <ul className="grid gap-2">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2 text-sm">
                <span className="tabular-nums">
                  v{v.version} · {format.dateTime(v.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </span>
                {v.isActive ? (
                  <span className="badge badge-fantasy">{t("active")}</span>
                ) : (
                  <ActionButton action={activateConfigVersion.bind(null, scope, v.version)} label={t("activate")} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
