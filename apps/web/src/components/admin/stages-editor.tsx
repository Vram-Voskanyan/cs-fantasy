"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { saveStages } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

type Stage = { id?: string; name: string; lockAt: string };

// <input type="datetime-local"> works in local time; we store and show UTC.
const toInput = (iso: string) => iso.slice(0, 16);
const fromInput = (value: string) => `${value}:00.000Z`;

export function StagesEditor({ tournamentId, initial }: { tournamentId: string; initial: Stage[] }) {
  const t = useTranslations("admin");
  const [stages, setStages] = useState(initial);
  const { pending, result, run } = useAdminAction();
  const update = (i: number, patch: Partial<Stage>) => setStages((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="grid gap-3">
      {stages.length === 0 ? <p className="text-sm text-fg-muted">{t("noStages")}</p> : null}
      {stages.map((s, i) => (
        <div key={s.id ?? `new-${i}`} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("stageName")}
            <input className="input w-48" value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lockAt")}
            <input className="input w-60" type="datetime-local" value={toInput(s.lockAt)} onChange={(e) => update(i, { lockAt: fromInput(e.target.value) })} />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setStages((list) => list.filter((_, j) => j !== i))}>
            {t("deleteStage")}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={() => setStages((list) => [...list, { name: "", lockAt: new Date(Date.now() + 86_400_000).toISOString() }])}
        >
          {t("addStage")}
        </Button>
        <Button variant="primary" size="sm" loading={pending} disabled={pending} onClick={() => run(() => saveStages(tournamentId, stages))}>
          {t("save")}
        </Button>
      </div>
      <ResultText result={result} />
    </div>
  );
}
