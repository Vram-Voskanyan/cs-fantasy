"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { setFantasyStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

const STATUSES = ["none", "announced", "open", "locked", "finished"] as const;

export function StatusSelect({ tournamentId, value }: { tournamentId: string; value: string }) {
  const t = useTranslations("admin");
  const [status, setStatus] = useState(value);
  const { pending, result, run } = useAdminAction();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("fantasyStatus")}
          <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" size="sm" loading={pending} disabled={pending} onClick={() => run(() => setFantasyStatus(tournamentId, status))}>
          {t("save")}
        </Button>
      </div>
      <ResultText result={result} />
    </div>
  );
}
