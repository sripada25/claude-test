"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorToast } from "@/components/board/ErrorToast";
import { STAGES } from "@/components/board/stages";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const STATUS_CHIP_STYLES: Record<string, string> = {
  saved: "bg-surface-2 border-border text-ink-2",
  applied: "bg-primary-soft border-primary text-primary",
  assessment: "bg-warning-soft border-warning text-warning",
  interview: "bg-violet-soft border-violet text-violet",
  offer: "bg-success-soft border-success text-success",
  rejected: "bg-danger-soft border-danger text-danger",
};

export function StatusChip({
  applicationId,
  status,
  onStatusChange,
  onConfirmed,
}: {
  applicationId: string;
  status: string;
  onStatusChange: (status: string) => void;
  onConfirmed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  async function selectStatus(next: string) {
    close();
    if (next === status) {
      return;
    }
    const previous = status;
    onStatusChange(next);
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        throw new Error("update_failed");
      }
      onConfirmed?.();
    } catch {
      onStatusChange(previous);
      setErrorMessage("Could not update status — please try again");
    }
  }

  const label = STAGES.find((stage) => stage.value === status)?.label ?? status;
  const styles = STATUS_CHIP_STYLES[status] ?? STATUS_CHIP_STYLES.saved;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 border px-3 py-2 font-body text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${styles}`}
      >
        <span className="hidden sm:inline">Status: {label}</span>
        <span className="sm:hidden">{label}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] border border-border bg-surface py-1 shadow-lg"
        >
          {STAGES.map((stage) => (
            <button
              key={stage.value}
              type="button"
              role="option"
              aria-selected={stage.value === status}
              onClick={() => selectStatus(stage.value)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[13px] text-ink hover:bg-surface-2"
            >
              <span className={`size-[7px] shrink-0 ${stage.colorClass}`} aria-hidden="true" />
              {stage.label}
            </button>
          ))}
        </div>
      )}
      {errorMessage && (
        <ErrorToast message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}
    </div>
  );
}
