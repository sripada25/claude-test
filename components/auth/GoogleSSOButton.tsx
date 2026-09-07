"use client";

function handleClick() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  window.location.href = `/api/oauth/google/start?timezone=${encodeURIComponent(timezone)}`;
}

export function GoogleSSOButton() {
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-[10px] border border-border-strong bg-surface px-4 py-[11px] font-body text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none"
    >
      <span
        className="grid size-[18px] place-items-center bg-[#1A73E8] font-display text-[10.5px] font-bold text-white"
        aria-hidden
      >
        G
      </span>
      Continue with Google
    </button>
  );
}
