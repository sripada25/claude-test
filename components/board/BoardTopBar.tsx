"use client";

import { Menu } from "lucide-react";
import { SearchInput } from "@/components/board/SearchInput";

export function BoardTopBar({
  onOpenDrawer,
  onQueryChange,
}: {
  onOpenDrawer: () => void;
  onQueryChange: (query: string) => void;
}) {
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
      <SearchInput onQueryChange={onQueryChange} />
    </header>
  );
}
