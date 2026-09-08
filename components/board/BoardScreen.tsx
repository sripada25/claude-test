"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { StageColumn } from "@/components/board/StageColumn";
import { STAGES } from "@/components/board/stages";
import type { BoardView } from "@/components/board/ViewToggle";
import { Sidebar } from "@/components/shell/Sidebar";

interface BoardApplication {
  id: string;
  status: string;
  source: string | null;
}

export function BoardScreen({
  initialView,
  initialCollapsedStages,
}: {
  initialView: BoardView;
  initialCollapsedStages: string[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<BoardView>(initialView);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<string[]>(initialCollapsedStages);
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

  function toggleCollapsed(stage: string) {
    setCollapsedStages((current) => {
      const next = current.includes(stage)
        ? current.filter((s) => s !== stage)
        : [...current, stage];
      document.cookie = `board_collapsed=${JSON.stringify(next)}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });
  }

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
          onAddApplication={() => setAddDrawerOpen(true)}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {applications.length} results
        </p>
        <div className="flex-1 overflow-x-auto px-7 py-[26px]">
          {view === "board" && (
            <div className="flex gap-4">
              {STAGES.map((stage) => {
                const stageApplications = applications.filter((a) => a.status === stage.value);
                return (
                  <StageColumn
                    key={stage.value}
                    value={stage.value}
                    label={stage.label}
                    colorClass={stage.colorClass}
                    count={stageApplications.length}
                    collapsed={collapsedStages.includes(stage.value)}
                    onToggleCollapse={() => toggleCollapsed(stage.value)}
                  >
                    {null}
                  </StageColumn>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
