"use client";

import { Info } from "lucide-react";

const MAX_LENGTH = 15000;
const DANGER_THRESHOLD = 13500;

export function JobDescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const count = value.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[5px]">
          <label
            htmlFor="jd"
            className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
          >
            Job description
          </label>
          <Info size={13} className="text-muted" aria-hidden="true" />
        </div>
        <span
          className={`font-mono text-[11px] ${count > DANGER_THRESHOLD ? "text-danger" : "text-muted"}`}
          aria-live="polite"
        >
          {count.toLocaleString("en-IN")} / {MAX_LENGTH.toLocaleString("en-IN")}
        </span>
      </div>
      <textarea
        id="jd"
        maxLength={MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-24 w-full resize-y border border-border bg-surface px-[13px] py-[11px] font-body text-[12.5px] leading-[1.5] text-ink md:h-[118px]"
      />
      <p className="font-body text-[11.5px] leading-[1.5] text-muted">
        Stored as a snapshot — later edits to the posting won&apos;t change what was used.
      </p>
    </div>
  );
}
