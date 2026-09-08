"use client";

import { useRouter } from "next/navigation";
import type { CardTagData } from "@/components/board/cardTags";

const VARIANT_CLASSES: Record<CardTagData["variant"], string> = {
  default: "bg-surface-2 text-ink-2",
  "follow-up": "bg-accent-soft text-accent",
};

export function CardTag({ tag }: { tag: CardTagData }) {
  const router = useRouter();
  const className = `flex items-center gap-1 px-[7px] py-[3px] font-mono text-[9.5px] font-semibold ${VARIANT_CLASSES[tag.variant]}`;

  if (tag.href) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          router.push(tag.href!);
        }}
        className={`${className} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`}
      >
        {tag.label}
      </button>
    );
  }

  return (
    <span className={className} aria-label={tag.ariaLabel}>
      {tag.label}
    </span>
  );
}

export function CardTagOverflow({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1 bg-surface-2 px-1.5 py-[3px] font-mono text-[9.5px] font-semibold text-muted">
      +{count}
    </span>
  );
}
