"use client";

/**
 * InfoHint — a small ⓘ icon that reveals a description on hover (CSS-only
 * tooltip, no library). Used to keep param/prop descriptions out of the way in
 * the schema table and params form until the user wants them.
 */
import { Info } from "lucide-react";

export function InfoHint({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex align-middle">
      <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-56 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug text-popover-foreground shadow-md group-hover/info:block"
      >
        {text}
      </span>
    </span>
  );
}
