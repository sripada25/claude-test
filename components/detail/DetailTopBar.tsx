"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/detail/StatusChip";

export function DetailTopBar({
  applicationId,
  status,
  onStatusChange,
}: {
  applicationId: string;
  status: string;
  onStatusChange: (status: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="flex h-16 items-center gap-[10px] border-b border-border bg-surface px-7">
      <button
        type="button"
        aria-label="Back to board"
        onClick={() => router.back()}
        className="flex size-11 items-center justify-center gap-[6px] text-ink-2 sm:size-auto sm:justify-start"
      >
        <ArrowLeft size={15} />
        <span className="hidden font-body text-[13px] font-medium sm:inline">Board</span>
      </button>
      <div className="flex-1" />
      <StatusChip applicationId={applicationId} status={status} onStatusChange={onStatusChange} />
    </div>
  );
}
