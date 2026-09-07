"use client";

import { Loader2 } from "lucide-react";

export function ProfileActions({
  saving,
  error,
  onBack,
  onSave,
}: {
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div>
      <div className="h-[34px]" />
      <div className="border-t border-border" />
      <div className="h-[22px]" />
      {error && <p className="mb-3 font-body text-[12px] text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="w-full border border-border-strong bg-surface px-[22px] py-[13px] font-body text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex w-full items-center justify-center gap-2 bg-primary px-[22px] py-[13px] font-body text-[13.5px] font-semibold tracking-[0.1px] text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted sm:w-auto"
        >
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Save & continue"}
        </button>
      </div>
    </div>
  );
}
