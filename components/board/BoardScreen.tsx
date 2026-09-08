"use client";

import type { Announcements } from "@dnd-kit/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { ApplicationCard } from "@/components/board/ApplicationCard";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { EmptyColumn } from "@/components/board/EmptyColumn";
import { StageColumn } from "@/components/board/StageColumn";
import { STAGES } from "@/components/board/stages";
import type { BoardView } from "@/components/board/ViewToggle";
import { Sidebar } from "@/components/shell/Sidebar";

function stageLabel(id: string | number | undefined): string {
  return STAGES.find((stage) => stage.value === id)?.label ?? "the board";
}

const dragAnnouncements: Announcements = {
  onDragStart: () => "Picked up application card.",
  onDragOver: ({ over }) => (over ? `Application card is over ${stageLabel(over.id)}.` : ""),
  onDragEnd: ({ over }) =>
    over ? `Application card dropped over ${stageLabel(over.id)}.` : "Application card dropped.",
  onDragCancel: () => "Dragging cancelled.",
};

interface BoardApplication {
  id: string;
  status: string;
  source: string | null;
  company: string;
  role: string;
  lastActivityAt: string;
  followUpDue: boolean;
  assessmentDueAt: string | null;
  interviewAt: string | null;
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
            <DndContext
              sensors={sensors}
              accessibility={{ announcements: dragAnnouncements }}
            >
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
                      {stageApplications.length === 0 ? (
                        <EmptyColumn />
                      ) : (
                        stageApplications.map((application) => (
                          <ApplicationCard
                            key={application.id}
                            id={application.id}
                            company={application.company}
                            role={application.role}
                            colorClass={stage.colorClass}
                            lastActivityAt={application.lastActivityAt}
                            followUpDue={application.followUpDue}
                            assessmentDueAt={application.assessmentDueAt}
                            interviewAt={application.interviewAt}
                          />
                        ))
                      )}
                    </StageColumn>
                  );
                })}
              </div>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  );
}
