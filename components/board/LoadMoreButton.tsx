export function LoadMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-[5px] border border-border-strong bg-surface px-3 py-1.5 font-mono text-[10.5px] font-semibold text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      Load more
    </button>
  );
}
