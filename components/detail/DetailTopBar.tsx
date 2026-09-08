"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ApplicationDetail } from "@/components/detail/DetailScreen";
import { OverflowMenu } from "@/components/detail/OverflowMenu";
import { StatusChip } from "@/components/detail/StatusChip";

export function DetailTopBar({
  application,
  onStatusChange,
}: {
  application: ApplicationDetail;
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
      <StatusChip
        applicationId={application.id}
        status={application.status}
        onStatusChange={onStatusChange}
      />
      <OverflowMenu application={application} />
    </div>
  );
}
