"use client";

import { ChevronDown, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

// M09-1: only "Delete my account" is real here - it's the one action in
// this whole section with existing backend (DELETE /api/account, built for
// F1). Export and retention have nothing behind them yet; retention shows
// "TBD" because the mockup itself hasn't decided a value, not because this
// task deferred it.
export function DataPrivacySection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/account", {
        method: "DELETE",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      });
    } catch {
      setError("Could not delete your account. Try again.");
      setDeleting(false);
      return;
    }

    if (!response.ok) {
      setError("Could not delete your account. Try again.");
      setDeleting(false);
      return;
    }

    router.push("/signin");
  }

  return (
    <div id="data" className="flex flex-col gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">
        Data &amp; privacy
      </span>
      <div className="flex flex-col gap-4 border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink">Export all my data</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">Coming soon</span>
            <button
              type="button"
              disabled
              className="flex items-center gap-[6px] border border-border-strong bg-surface px-[14px] py-[8px] font-body text-[12.5px] font-semibold text-muted disabled:cursor-not-allowed"
            >
              <Download size={14} aria-hidden />
              Download
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink">Call transcripts kept for</span>
          <span className="flex items-center gap-[6px] border border-border-strong px-[10px] py-[6px]">
            <span className="font-mono text-[11px] font-semibold text-muted">TBD</span>
            <ChevronDown size={13} className="text-muted" aria-hidden />
          </span>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink">Delete my account and all data</span>
          {!confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="border border-danger bg-surface px-[14px] py-[8px] font-body text-[12.5px] font-semibold text-danger"
            >
              Delete
            </button>
          )}
        </div>

        {confirming && (
          <div className="flex flex-col gap-3 border border-danger bg-surface-2 p-3">
            <p className="font-body text-[11.5px] text-muted">
              Deletion removes applications, documents, call transcripts, and reminders permanently. It cannot be
              undone.
            </p>
            {error && <p className="font-body text-[12px] text-danger">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="border border-danger bg-danger px-[14px] py-[8px] font-body text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="border border-border-strong bg-surface px-[14px] py-[8px] font-body text-[12.5px] font-semibold text-ink disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
