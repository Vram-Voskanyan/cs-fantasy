"use client";

import type { ActionResult } from "@/app/admin/actions";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

export function ActionButton({
  action,
  label,
  variant = "secondary",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  variant?: ButtonVariant;
}) {
  const { pending, result, run } = useAdminAction();
  return (
    <div className="grid gap-1.5">
      <Button variant={variant} size="sm" loading={pending} disabled={pending} onClick={() => run(action)}>
        {label}
      </Button>
      <ResultText result={result} />
    </div>
  );
}
