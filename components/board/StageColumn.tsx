import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { CollapsedColumn } from "@/components/board/CollapsedColumn";

export function StageColumn({
  value,
  label,
  colorClass,
  count,
  collapsed,
  onToggleCollapse,
  cardIds,
  children,
}: {
  value: string;
  label: string;
  colorClass: string;
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  cardIds: string[];
  children: ReactNode;
}) {
  const bodyId = `col-${value}`;
  const { setNodeRef } = useDroppable({ id: value });

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${label}, ${count} application${count === 1 ? "" : "s"}`}
        className="shrink-0"
      >
        <CollapsedColumn
          label={label}
          colorClass={colorClass}
          count={count}
          bodyId={bodyId}
          onExpand={onToggleCollapse}
        />
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${count} application${count === 1 ? "" : "s"}`}
      className="w-[200px] shrink-0"
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-[7px] px-0.5 pb-2.5"
      >
        <div className="flex items-center gap-[7px]">
          <span className={`size-[7px] shrink-0 ${colorClass}`} aria-hidden="true" />
          <span className="font-body text-[13px] font-semibold text-ink">{label}</span>
        </div>
        <span className="font-mono text-[11.5px] text-muted">{count}</span>
      </button>
      <div
        id={bodyId}
        className="flex max-h-[calc(100vh-220px)] flex-col gap-[10px] overflow-y-auto max-md:max-h-[calc(100vh-180px)]"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </section>
  );
}
