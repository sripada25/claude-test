"use client";

import { Menu } from "lucide-react";
import { AddApplicationButton } from "@/components/board/AddApplicationButton";
import { SearchInput } from "@/components/board/SearchInput";
import { SortControl } from "@/components/board/SortControl";
import { SourceFilter } from "@/components/board/SourceFilter";
import { StatusFilter } from "@/components/board/StatusFilter";
import { ViewToggle, type BoardView } from "@/components/board/ViewToggle";

export function BoardTopBar({
  onOpenDrawer,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  hasAnySource,
  sort,
  onSortChange,
  view,
  onViewChange,
  onAddApplication,
}: {
  onOpenDrawer: () => void;
  onQueryChange: (query: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  sourceFilter: string[];
  onSourceFilterChange: (values: string[]) => void;
  hasAnySource: boolean;
  sort: string;
  onSortChange: (value: string) => void;
  view: BoardView;
  onViewChange: (value: BoardView) => void;
  onAddApplication: () => void;
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
      <div className="hidden items-center gap-[14px] md:flex">
        <StatusFilter selected={statusFilter} onChange={onStatusFilterChange} />
        <SourceFilter
          selected={sourceFilter}
          onChange={onSourceFilterChange}
          hasAnySource={hasAnySource}
        />
        <SortControl value={sort} onChange={onSortChange} />
      </div>
      <ViewToggle value={view} onChange={onViewChange} />
      <AddApplicationButton onClick={onAddApplication} />
    </header>
  );
}
