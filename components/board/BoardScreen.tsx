"use client";

import type { Announcements, DragEndEvent } from "@dnd-kit/core";
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
import { ApplicationFields, type ApplicationFieldsValues } from "@/components/board/ApplicationFields";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { Drawer } from "@/components/board/Drawer";
import { DrawerHeader } from "@/components/board/DrawerHeader";
import { EmptyColumn } from "@/components/board/EmptyColumn";
import { ErrorToast } from "@/components/board/ErrorToast";
import { GenerateCheckbox } from "@/components/board/GenerateCheckbox";
import { JobDescriptionField } from "@/components/board/JobDescriptionField";
import { StageColumn } from "@/components/board/StageColumn";
import { STAGES } from "@/components/board/stages";
import type { BoardView } from "@/components/board/ViewToggle";
import { Sidebar } from "@/components/shell/Sidebar";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

function stageLabel(id: string | number | undefined): string {
  return STAGES.find((stage) => stage.value === id)?.label ?? "the board";
}

const INITIAL_DRAFT: ApplicationFieldsValues = {
  company: "",
  role: "",
  status: "saved",
  dateApplied: "",
  source: "",
  sourceUrl: "",
  jobDescription: "",
};

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApplicationFieldsValues>(INITIAL_DRAFT);
  const [generateChecked, setGenerateChecked] = useState(false);
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

  function setApplicationStatus(id: string, status: string) {
    setApplications((current) => current.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  async function moveApplication(id: string, from: string, to: string) {
    setApplicationStatus(id, to);
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ status: to }),
      });
      if (!response.ok) {
        throw new Error("update_failed");
      }
    } catch {
      setApplicationStatus(id, from);
      setErrorMessage("Could not update — please try again");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const application = applications.find((a) => a.id === active.id);
    if (!application || application.status === over.id) {
      return;
    }
    void moveApplication(application.id, application.status, String(over.id));
  }

  function updateDraft(patch: Partial<ApplicationFieldsValues>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function closeAddDrawer() {
    setAddDrawerOpen(false);
    setDraft(INITIAL_DRAFT);
    setGenerateChecked(false);
  }

  const isDraftDirty =
    generateChecked ||
    Object.keys(INITIAL_DRAFT).some(
      (key) => draft[key as keyof ApplicationFieldsValues] !== INITIAL_DRAFT[key as keyof ApplicationFieldsValues],
    );

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
              onDragEnd={handleDragEnd}
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
      {errorMessage && (
        <ErrorToast message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}
      <Drawer open={addDrawerOpen} onClose={closeAddDrawer} isDirty={isDraftDirty}>
        <DrawerHeader title="Add application" />
        <div className="flex flex-col gap-[18px] overflow-y-auto px-7 pt-6">
          <ApplicationFields values={draft} onChange={updateDraft} />
          <JobDescriptionField
            value={draft.jobDescription}
            onChange={(value) => updateDraft({ jobDescription: value })}
          />
          <GenerateCheckbox checked={generateChecked} onChange={setGenerateChecked} open={addDrawerOpen} />
        </div>
      </Drawer>
    </div>
  );
}
