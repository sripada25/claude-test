"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { CardTag, CardTagOverflow } from "@/components/board/CardTag";
import { deriveCardTags } from "@/components/board/cardTags";

export function ApplicationCard({
  id,
  company,
  role,
  colorClass,
  lastActivityAt,
  followUpDue,
  assessmentDueAt,
  interviewAt,
}: {
  id: string;
  company: string;
  role: string;
  colorClass: string;
  lastActivityAt: string;
  followUpDue: boolean;
  assessmentDueAt: string | null;
  interviewAt: string | null;
}) {
  const router = useRouter();
  const { visible, overflowCount } = deriveCardTags({
    id,
    lastActivityAt,
    followUpDue,
    assessmentDueAt,
    interviewAt,
  });
  const { setNodeRef, attributes, listeners, transform } = useDraggable({ id });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      aria-label={`${company}, ${role}`}
      onClick={() => router.push(`/app/applications/${id}`)}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter") {
          router.push(`/app/applications/${id}`);
        }
      }}
      className="flex cursor-pointer flex-col border-x border-b border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      <div className={`h-[3px] w-full ${colorClass}`} aria-hidden="true" />
      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-[11px]">
        <span className="font-body text-[13px] font-semibold text-ink">{company}</span>
        <span className="font-body text-[11.5px] text-ink-2">{role}</span>
        <div className="flex flex-wrap items-center gap-[5px]">
          {visible.map((tag) => (
            <CardTag key={tag.key} tag={tag} />
          ))}
          {overflowCount > 0 && <CardTagOverflow count={overflowCount} />}
        </div>
      </div>
    </article>
  );
}
