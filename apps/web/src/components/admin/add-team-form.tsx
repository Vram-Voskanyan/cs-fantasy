"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { addCitoTeam } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

export function AddTeamForm({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("admin");
  const [slug, setSlug] = useState("");
  const { pending, result, run } = useAdminAction();
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input h-9 w-56" value={slug} placeholder={t("addTeamSlug")} aria-label={t("addTeamSlug")} onChange={(e) => setSlug(e.target.value)} />
        <Button size="sm" loading={pending} disabled={pending || !slug.trim()} onClick={() => run(() => addCitoTeam(tournamentId, slug))}>
          {t("addTeam")}
        </Button>
      </div>
      <ResultText result={result} />
    </div>
  );
}
