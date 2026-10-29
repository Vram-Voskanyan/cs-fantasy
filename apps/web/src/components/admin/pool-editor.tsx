"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { savePrices } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

export type PoolRow = { playerId: string; nickname: string; teamName: string; rating: number | null; price: number; isAvailable: boolean };

export function PoolEditor({ tournamentId, rows, step }: { tournamentId: string; rows: PoolRow[]; step: number }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [items, setItems] = useState(rows);
  const { pending, result, run } = useAdminAction();
  const update = (id: string, patch: Partial<PoolRow>) => setItems((list) => list.map((r) => (r.playerId === id ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="label text-left">
              <th className="py-2 pr-3">{t("player")}</th>
              <th className="py-2 pr-3">{t("team")}</th>
              <th className="py-2 pr-3 text-right">{t("citoRating")}</th>
              <th className="py-2 pr-3">{t("price")}</th>
              <th className="py-2">{t("available")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.playerId} className="border-t border-border">
                <td className="py-2 pr-3 font-medium">{r.nickname}</td>
                <td className="py-2 pr-3 text-fg-muted">{r.teamName}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.rating === null ? "–" : format.number(r.rating, { minimumFractionDigits: 2 })}</td>
                <td className="py-2 pr-3">
                  <input
                    className="input h-9 w-24 tabular-nums"
                    type="number"
                    step={step / 10}
                    value={r.price / 10}
                    aria-label={`${t("price")} ${r.nickname}`}
                    onChange={(e) => update(r.playerId, { price: Math.round(Number(e.target.value) * 10) })}
                  />
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={r.isAvailable}
                    aria-label={`${t("available")} ${r.nickname}`}
                    onChange={(e) => update(r.playerId, { isAvailable: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => run(() => savePrices(tournamentId, items.map(({ playerId, price, isAvailable }) => ({ playerId, price, isAvailable }))))}
        >
          {t("savePrices")}
        </Button>
      </div>
      <ResultText result={result} />
    </div>
  );
}
