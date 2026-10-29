"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/actions";

/** Runs an admin server action and returns a translated result message. */
export function useAdminAction() {
  const t = useTranslations("admin.results");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  function run(action: () => Promise<ActionResult>) {
    start(async () => {
      const r = await action();
      // Result keys are fixed in strings_en.json under admin.results.
      setResult({ ok: r.ok, text: t(r.key as "ok", r.values as never) });
    });
  }
  return { pending, result, run };
}

export function ResultText({ result }: { result?: { ok: boolean; text: string } }) {
  if (!result) return null;
  return (
    <p role="status" className={`text-sm ${result.ok ? "text-positive" : "text-negative"}`}>
      {result.text}
    </p>
  );
}
