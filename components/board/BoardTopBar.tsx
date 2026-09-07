"use client";

import { Menu } from "lucide-react";

export function BoardTopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-[14px] border-b border-border bg-surface px-7">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        className="grid size-11 -ml-2 place-items-center text-ink-2 lg:hidden"
      >
        <Menu size={20} />
      </button>
    </header>
  );
}
