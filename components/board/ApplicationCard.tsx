"use client";

import { useRouter } from "next/navigation";

export function ApplicationCard({
  id,
  company,
  role,
  colorClass,
}: {
  id: string;
  company: string;
  role: string;
  colorClass: string;
}) {
  const router = useRouter();

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`${company}, ${role}`}
      onClick={() => router.push(`/app/applications/${id}`)}
      onKeyDown={(event) => {
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
        <div className="flex flex-wrap items-center gap-[5px]" />
      </div>
    </article>
  );
}
