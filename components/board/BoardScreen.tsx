"use client";

import type { Announcements, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApplicationCard } from "@/components/board/ApplicationCard";
import { SortableApplicationCard } from "@/components/board/SortableApplicationCard";
import { ApplicationFields, type ApplicationFieldsValues } from "@/components/board/ApplicationFields";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { Drawer } from "@/components/board/Drawer";
import { DrawerActions } from "@/components/board/DrawerActions";
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
  position: number | null;
}

function syntheticPosition(app: BoardApplication, indexInColumn: number): number {
  return app.position ?? indexInColumn * 1000;
}

function sortByPosition(apps: BoardApplication[]): BoardApplication[] {
  return [...apps].sort((a, b) => {
    if (a.position == null && b.position == null) return 0;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position;
  });
}

function computePosition(columnApps: BoardApplication[], index: number): number {
  const prev = columnApps[index - 1];
  const next = columnApps[index + 1];
  const prevPos = prev ? syntheticPosition(prev, index - 1) : null;
  const nextPos = next ? syntheticPosition(next, index + 1) : null;

  if (prevPos == null && nextPos == null) return 1000;
  if (prevPos == null) return nextPos! - 1000;
  if (nextPos == null) return prevPos + 1000;
  return (prevPos + nextPos) / 2;
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
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  async function moveApplication(id: string, from: string, to: string, position?: number) {
    const fromPosition = applications.find((a) => a.id === id)?.position ?? null;
    setApplications((current) => {
      const next = current.map((a) =>
        a.id === id ? { ...a, status: to, ...(position !== undefined ? { position } : {}) } : a,
      );
      return sort === "manual" && position !== undefined ? sortByPosition(next) : next;
    });
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ status: to, ...(position !== undefined ? { position } : {}) }),
      });
      if (!response.ok) {
        throw new Error("update_failed");
      }
    } catch {
      setApplications((current) => {
        const next = current.map((a) =>
          a.id === id ? { ...a, status: from, position: fromPosition } : a,
        );
        return sort === "manual" ? sortByPosition(next) : next;
      });
      setErrorMessage("Could not update — please try again");
    }
  }

  async function reposition(id: string, position: number) {
    const previousPosition = applications.find((a) => a.id === id)?.position ?? null;
    setApplications((current) =>
      sortByPosition(current.map((a) => (a.id === id ? { ...a, position } : a))),
    );
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ position }),
      });
      if (!response.ok) {
        throw new Error("reorder_failed");
      }
    } catch {
      setApplications((current) =>
        sortByPosition(current.map((a) => (a.id === id ? { ...a, position: previousPosition } : a))),
      );
      setErrorMessage("Could not update — please try again");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeApp = applications.find((a) => a.id === active.id);
    if (!activeApp) {
      return;
    }

    const overIsColumn = STAGES.some((stage) => stage.value === over.id);
    const overApp = overIsColumn ? null : applications.find((a) => a.id === over.id);
    const targetStatus = overIsColumn ? String(over.id) : overApp?.status;
    if (!targetStatus) {
      return;
    }

    if (targetStatus !== activeApp.status) {
      if (sort === "manual") {
        const columnApps = applications.filter((a) => a.status === targetStatus);
        const maxPosition = columnApps.reduce((max, a) => Math.max(max, a.position ?? 0), 0);
        void moveApplication(activeApp.id, activeApp.status, targetStatus, maxPosition + 1);
      } else {
        void moveApplication(activeApp.id, activeApp.status, targetStatus);
      }
      return;
    }

    if (sort !== "manual" || !overApp || overApp.id === activeApp.id) {
      return;
    }

    const columnApps = applications.filter((a) => a.status === activeApp.status);
    const oldIndex = columnApps.findIndex((a) => a.id === activeApp.id);
    const newIndex = columnApps.findIndex((a) => a.id === overApp.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(columnApps, oldIndex, newIndex);
    void reposition(activeApp.id, computePosition(reordered, newIndex));
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

  const canSave = draft.company.trim() !== "" && draft.role.trim() !== "";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({
          company: draft.company,
          role: draft.role,
          status: draft.status,
          dateApplied: draft.dateApplied || null,
          source: draft.source || null,
          sourceUrl: draft.sourceUrl || null,
          jobDescription: draft.jobDescription || null,
        }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const created = await response.json();
      setApplications((current) => [
        ...current,
        {
          id: created.id,
          status: created.status,
          source: created.source,
          company: created.company,
          role: created.role,
          lastActivityAt: created.lastActivityAt,
          followUpDue: false,
          assessmentDueAt: created.assessmentDueAt,
          interviewAt: created.interviewAt,
          position: created.position,
        },
      ]);
      setAddDrawerOpen(false);
      setDraft(INITIAL_DRAFT);
      setGenerateChecked(false);
    } catch {
      setErrorMessage("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  }

  const hasAnySource = useMemo(
    () => applications.some((application) => application.source != null),
    [applications],
  );

  const activeApplication = applications.find((application) => application.id === activeId);
  const activeStage = activeApplication
    ? STAGES.find((stage) => stage.value === activeApplication.status)
    : undefined;

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
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
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
                      cardIds={stageApplications.map((a) => a.id)}
                    >
                      {stageApplications.length === 0 ? (
                        <EmptyColumn />
                      ) : (
                        stageApplications.map((application) => (
                          <SortableApplicationCard
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
              <DragOverlay>
                {activeApplication && (
                  <ApplicationCard
                    id={activeApplication.id}
                    company={activeApplication.company}
                    role={activeApplication.role}
                    colorClass={activeStage?.colorClass ?? ""}
                    lastActivityAt={activeApplication.lastActivityAt}
                    followUpDue={activeApplication.followUpDue}
                    assessmentDueAt={activeApplication.assessmentDueAt}
                    interviewAt={activeApplication.interviewAt}
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>
      {errorMessage && (
        <ErrorToast message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}
      <Drawer open={addDrawerOpen} onClose={closeAddDrawer} isDirty={isDraftDirty}>
        <DrawerHeader title="Add application" />
        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-7 pt-6">
            <ApplicationFields values={draft} onChange={updateDraft} />
            <JobDescriptionField
              value={draft.jobDescription}
              onChange={(value) => updateDraft({ jobDescription: value })}
            />
            <GenerateCheckbox checked={generateChecked} onChange={setGenerateChecked} open={addDrawerOpen} />
          </div>
          <DrawerActions saving={saving} canSave={canSave} />
        </form>
      </Drawer>
    </div>
  );
}
