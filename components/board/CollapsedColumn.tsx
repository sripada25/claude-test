export function CollapsedColumn({
  label,
  colorClass,
  count,
  bodyId,
  onExpand,
}: {
  label: string;
  colorClass: string;
  count: number;
  bodyId: string;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded="false"
      aria-controls={bodyId}
      className="flex w-14 flex-col items-center gap-4 py-1 opacity-[0.55]"
    >
      <span className={`size-[7px] shrink-0 ${colorClass}`} aria-hidden="true" />
      <span className="font-body text-[12.5px] font-semibold text-ink-2 [writing-mode:vertical-rl] rotate-180">
        {label}
      </span>
      <span className="font-mono text-[12px] text-muted">{count}</span>
    </button>
  );
}
