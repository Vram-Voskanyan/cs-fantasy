"use client";

import { useState } from "react";
import type { ActionResult } from "@/app/admin/actions";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ResultText, useAdminAction } from "./use-admin-action";

export function ActionButton({
  action,
  label,
  variant = "secondary",
  confirmLabel,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  variant?: ButtonVariant;
  // When set, the first click asks for a second click (for destructive actions).
  confirmLabel?: string;
}) {
  const { pending, result, run } = useAdminAction();
  const [armed, setArmed] = useState(false);
  function onClick() {
    if (confirmLabel && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    run(action);
  }
  return (
    <div className="grid gap-1.5">
      <Button variant={variant} size="sm" loading={pending} disabled={pending} onClick={onClick} onBlur={() => setArmed(false)}>
        {armed ? confirmLabel : label}
      </Button>
      <ResultText result={result} />
    </div>
  );
}
