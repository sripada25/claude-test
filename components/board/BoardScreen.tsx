"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import type { BoardView } from "@/components/board/ViewToggle";
import { Sidebar } from "@/components/shell/Sidebar";

interface BoardApplication {
  id: string;
  status: string;
  source: string | null;
}

export function BoardScreen({ initialView }: { initialView: BoardView }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<BoardView>(initialView);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [sort, setSort] = useState("recent");
  const [applications, setApplications] = useState<BoardApplication[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams();
      if (query) {
        params.set("q", query);
      }
      for (const status of statusFilter) {
        params.append("status", status);
      }
      for (const source of sourceFilter) {
        params.append("source", source);
      }
      params.set("sort", sort);

      const response = await fetch(`/api/applications?${params.toString()}`).catch(() => null);
      if (!response?.ok) {
        return;
      }
      const data = await response.json();
      if (!cancelled) {
        setApplications(data);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query, statusFilter, sourceFilter, sort]);

  const hasAnySource = useMemo(
    () => applications.some((application) => application.source != null),
    [applications],
  );

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <BoardTopBar
          onOpenDrawer={() => setDrawerOpen(true)}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          hasAnySource={hasAnySource}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {applications.length} results
        </p>
        <div className="flex-1 overflow-x-auto px-7 py-[26px]">
          <div className="flex gap-4" />
        </div>
      </main>
    </div>
  );
}
