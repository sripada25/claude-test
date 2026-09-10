"use client";

import { useState } from "react";
import { Pencil, RotateCw } from "lucide-react";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import { useGenerationPoll, type GeneratedDocumentView } from "@/hooks/useGenerationPoll";

// [6,10] below md becomes [11,14] per TASKS-FRONTEND_quarterfinal.md's own fix for
// the 44px touch-target minimum - but that number was sized for the text+icon
// case. Once labels drop to icon-only below sm, [11,14] measures ~34x40px, short
// of the stated 44x44 goal (the doc's own arithmetic already estimated "[6,10] ≈
// 28px" loosely). max-sm:p-[16px] restores the actual 44x44 minimum for the
// icon-only case specifically, without touching the literal [11,14] the doc gives
// for the sm-to-md range where the label is still visible.
const GHOST_BUTTON_BASE_CLASS =
  "flex items-center gap-[5px] px-[10px] py-[6px] max-md:px-[14px] max-md:py-[11px] max-sm:p-[16px] font-body text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-muted";

const GHOST_BUTTON_CLASS = `${GHOST_BUTTON_BASE_CLASS} bg-surface-2 text-ink-2`;
const GHOST_BUTTON_PRESSED_CLASS = `${GHOST_BUTTON_BASE_CLASS} bg-accent-soft text-accent`;

export function ResultActions({
  documentId,
  remaining,
  editing,
  onToggleEdit,
  onRegenerateSucceeded,
}: {
  documentId: string;
  remaining: number | null;
  editing: boolean;
  onToggleEdit: () => void;
  onRegenerateSucceeded: (document: GeneratedDocumentView) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { state, trigger } = useGenerationPoll(onRegenerateSucceeded);

  const generating = state === "generating";
  const failed = state === "failed";

  function handleRegenerateClick() {
    if (failed) {
      trigger(() =>
        fetch(`/api/documents/${documentId}/regenerate`, {
          method: "POST",
          headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
        }),
      );
      return;
    }
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    trigger(() =>
      fetch(`/api/documents/${documentId}/regenerate`, {
        method: "POST",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      }),
    );
  }

  function handleCancel() {
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-[10px]">
        <span className="font-body text-[12px] font-semibold text-ink-2">
          Regenerate? This uses 1 generation
        </span>
        <button type="button" onClick={handleConfirm} className={GHOST_BUTTON_CLASS}>
          Confirm
        </button>
        <button type="button" onClick={handleCancel} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
      </div>
    );
  }

  const regenerateDisabled = remaining === 0 || generating;
  const regenerateLabel = generating ? "Regenerating..." : failed ? "Retry" : "Regenerate";

  return (
    <div className="flex flex-wrap gap-[10px]">
      <button
        type="button"
        onClick={handleRegenerateClick}
        disabled={regenerateDisabled}
        aria-label={regenerateLabel}
        className={GHOST_BUTTON_CLASS}
      >
        <RotateCw size={12} aria-hidden />
        <span className="max-sm:hidden">
          {regenerateLabel}
          {!generating && !failed && remaining !== null && remaining > 0 && ` (${remaining} left)`}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleEdit}
        aria-pressed={editing}
        aria-label="Edit"
        className={editing ? GHOST_BUTTON_PRESSED_CLASS : GHOST_BUTTON_CLASS}
      >
        <Pencil size={12} aria-hidden />
        <span className="max-sm:hidden">Edit</span>
      </button>
    </div>
  );
}
