"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ApplicationCard } from "@/components/board/ApplicationCard";

export function SortableApplicationCard({
  id,
  company,
  role,
  colorClass,
  lastActivityAt,
  followUpDue,
  followUpSentToday,
  assessmentDueAt,
  interviewAt,
}: {
  id: string;
  company: string;
  role: string;
  colorClass: string;
  lastActivityAt: string;
  followUpDue: boolean;
  followUpSentToday: boolean;
  assessmentDueAt: string | null;
  interviewAt: string | null;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });

  return (
    <ApplicationCard
      id={id}
      company={company}
      role={role}
      colorClass={colorClass}
      lastActivityAt={lastActivityAt}
      followUpDue={followUpDue}
      followUpSentToday={followUpSentToday}
      assessmentDueAt={assessmentDueAt}
      interviewAt={interviewAt}
      dragRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      dragAttributes={attributes}
      dragListeners={listeners}
      dragging={isDragging}
    />
  );
}
