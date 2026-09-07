import type { ReactNode } from "react";

export function StageColumn({
  label,
  colorClass,
  count,
  children,
}: {
  label: string;
  colorClass: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={`${label}, ${count} application${count === 1 ? "" : "s"}`}
      className="w-[200px] shrink-0"
    >
      <div className="flex items-center justify-between gap-[7px] px-0.5 pb-2.5">
        <div className="flex items-center gap-[7px]">
          <span className={`size-[7px] shrink-0 rounded-full ${colorClass}`} aria-hidden="true" />
          <span className="font-body text-[13px] font-semibold text-ink">{label}</span>
        </div>
        <span className="font-mono text-[11.5px] text-muted">{count}</span>
      </div>
      <div className="flex max-h-[calc(100vh-220px)] flex-col gap-[10px] overflow-y-auto max-md:max-h-[calc(100vh-180px)]">
        {children}
      </div>
    </section>
  );
}
