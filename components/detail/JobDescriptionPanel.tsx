"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function JobDescriptionPanel({ jobDescription }: { jobDescription: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!jobDescription) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-[12px_14px] sm:p-[16px_18px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
          Job description snapshot
        </span>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls="jd-panel-body"
          className="flex items-center gap-1 font-body text-[12px] font-semibold text-accent"
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown size={13} className={expanded ? "rotate-180" : ""} />
        </button>
      </div>
      <p
        id="jd-panel-body"
        className={`whitespace-pre-wrap font-body text-[13px] leading-[1.6] text-ink-2 ${expanded ? "" : "line-clamp-3"}`}
      >
        {jobDescription}
      </p>
    </div>
  );
}
