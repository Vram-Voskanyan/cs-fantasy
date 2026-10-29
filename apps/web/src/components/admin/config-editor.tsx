"use client";

import type { GameConfig } from "@cs-vv-fantasy/scoring";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { builtInDefaults, saveGameConfig } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

type Json = number | boolean | string | Json[] | { [key: string]: Json };
type Tier = { min: number; points: number };

const SECTIONS = ["roster", "scoring", "format", "roles", "pricing"] as const;
const ENUMS: Record<string, string[]> = { mapCountMode: ["sum", "average_x_factor"] };

function setAt(obj: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) return obj.map((v, i) => (i === head ? setAt(v, rest, value) : v));
  const record = obj as Record<string, Json>;
  return { ...record, [head]: setAt(record[head as string], rest, value) };
}

const isTierList = (v: Json): v is Tier[] =>
  Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null && "min" in (x as object) && "points" in (x as object));

/** Edits every field of the game config. Labels come from strings_en.json (admin.fields, roles). */
export function ConfigEditor({ scope, initial }: { scope: string; initial: GameConfig }) {
  const t = useTranslations();
  const [config, setConfig] = useState<Json>(initial as unknown as Json);
  const { pending, result, run } = useAdminAction();
  const update = (path: (string | number)[], value: Json) => setConfig((c) => setAt(c, path, value));

  const label = (key: string, parent?: string) => {
    if (parent === "roles") return t(`roles.${key}.name` as "roles.none");
    return t.has(`admin.fields.${key}` as "admin.fields.size") ? t(`admin.fields.${key}` as "admin.fields.size") : key;
  };

  function renderValue(value: Json, path: (string | number)[], key: string, parent?: string): React.ReactNode {
    const id = `cfg-${path.join("-")}`;
    if (isTierList(value)) {
      return (
        <fieldset key={id} className="grid gap-2">
          <legend className="text-sm font-medium">{label(key)}</legend>
          {value.map((tier, i) => (
            <div key={`${id}-${i}`} className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-fg-muted">
                {t("admin.fields.min")}
                <input
                  className="input h-9 w-24"
                  type="number"
                  step="any"
                  value={tier.min}
                  onChange={(e) => update([...path, i, "min"], Number(e.target.value))}
                />
              </label>
              <label className="grid gap-1 text-xs text-fg-muted">
                {t("admin.fields.points")}
                <input
                  className="input h-9 w-24"
                  type="number"
                  step="any"
                  value={tier.points}
                  onChange={(e) => update([...path, i, "points"], Number(e.target.value))}
                />
              </label>
              <Button variant="ghost" size="sm" onClick={() => update(path, value.filter((_, j) => j !== i) as Json)}>
                {t("admin.fields.removeTier")}
              </Button>
            </div>
          ))}
          <div>
            <Button size="sm" onClick={() => update(path, [...value, { min: 0, points: 0 }] as Json)}>
              {t("admin.fields.addTier")}
            </Button>
          </div>
        </fieldset>
      );
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return (
        <fieldset key={id} className="grid content-start gap-3 rounded-[6px] border border-border p-3">
          <legend className="px-1 text-sm font-semibold">{label(key, parent)}</legend>
          {Object.entries(value).map(([k, v]) => renderValue(v, [...path, k], k, key))}
        </fieldset>
      );
    }
    if (typeof value === "boolean") {
      return (
        <label key={id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={value} onChange={(e) => update(path, e.target.checked)} />
          {label(key)}
        </label>
      );
    }
    if (typeof value === "string" && ENUMS[key]) {
      return (
        <label key={id} className="grid gap-1.5 text-sm font-medium">
          {label(key)}
          <select className="input" value={value} onChange={(e) => update(path, e.target.value)}>
            {ENUMS[key].map((option) => (
              <option key={option} value={option}>
                {t(`admin.modes.${option}` as "admin.modes.sum")}
              </option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <label key={id} className="grid gap-1.5 text-sm font-medium">
        {label(key)}
        <input className="input" type="number" step="any" value={value as number} onChange={(e) => update(path, Number(e.target.value))} />
      </label>
    );
  }

  const root = config as Record<string, Json>;
  return (
    <div className="grid gap-6">
      {SECTIONS.map((section) => (
        <section key={section} className="card grid gap-4">
          <h2 className="font-display text-xl font-bold">{t(`admin.sections.${section}`)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(root[section] as Record<string, Json>).map(([k, v]) => renderValue(v, [section, k], k, section))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" loading={pending} disabled={pending} onClick={() => run(() => saveGameConfig(scope, config))}>
          {t("admin.saveConfig")}
        </Button>
        <Button variant="ghost" onClick={async () => setConfig((await builtInDefaults()) as unknown as Json)}>
          {t("admin.resetDefaults")}
        </Button>
      </div>
      <ResultText result={result} />
    </div>
  );
}
