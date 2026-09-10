"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function GenerateTopBar({
  applicationId,
  company,
  role,
}: {
  applicationId: string;
  company: string;
  role: string;
}) {
  const router = useRouter();

  return (
    <div className="flex h-16 items-center border-b border-border bg-surface px-8">
      <button
        type="button"
        aria-label={`Back to ${company} — ${role}`}
        onClick={() => router.push(`/app/applications/${applicationId}`)}
        className="flex min-w-0 items-center gap-[6px] text-ink-2"
      >
        <ArrowLeft size={15} className="shrink-0" />
        <span className="truncate font-body text-[13px] font-medium">
          {company} — {role}
        </span>
      </button>
    </div>
  );
}
