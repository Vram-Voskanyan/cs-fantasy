"use client";

import { type ReactNode, useState } from "react";
import { Button } from "./button";

/** Hides extra content behind a button. The content is rendered on the server and only shown on demand. */
export function ShowMore({ label, lessLabel, children }: { label: string; lessLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      {open ? children : null}
      <div>
        <Button size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? lessLabel : label}
        </Button>
      </div>
    </div>
  );
}
