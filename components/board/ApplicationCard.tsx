"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent } from "react";
import { CardTag, CardTagOverflow } from "@/components/board/CardTag";
import { deriveCardTags } from "@/components/board/cardTags";

export function ApplicationCard({
  id,
  company,
  role,
  colorClass,
  lastActivityAt,
  followUpDue,
  followUpSentToday,
  assessmentDueAt,
  interviewAt,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  dragging,
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
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  dragging?: boolean;
}) {
  const router = useRouter();
  const { visible, overflowCount } = deriveCardTags({
    id,
    lastActivityAt,
    followUpDue,
    followUpSentToday,
    assessmentDueAt,
    interviewAt,
  });

  return (
    <article
      ref={dragRef}
      style={dragStyle}
      {...dragAttributes}
      {...dragListeners}
      aria-label={`${company}, ${role}`}
      onClick={() => router.push(`/app/applications/${id}`)}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        dragListeners?.onKeyDown?.(event);
        if (event.key === "Enter") {
          router.push(`/app/applications/${id}`);
        }
      }}
      className={`flex cursor-pointer flex-col border-x border-b border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
        dragging ? "opacity-40" : ""
      }`}
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
