import { Info } from "lucide-react";

export function LastCallPanel() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
          From the last call
        </span>
        <Info size={13} className="text-muted" aria-hidden />
      </div>
      <div className="flex min-h-[56px] items-center justify-center border border-border bg-surface px-[14px] py-[12px]">
        <span className="font-body text-[12px] text-muted">No calls logged yet.</span>
      </div>
    </div>
  );
}
