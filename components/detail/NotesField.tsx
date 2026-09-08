"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorToast } from "@/components/board/ErrorToast";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const DEBOUNCE_MS = 500;
const SAVED_INDICATOR_MS = 2000;

export function NotesField({
  applicationId,
  notes,
  onSaved,
}: {
  applicationId: string;
  notes: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(notes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef(notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const valueRef = useRef(value);
  valueRef.current = value;

  async function save(notesToSave: string) {
    setStatus("saving");
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ notes: notesToSave }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      lastSavedRef.current = notesToSave;
      setStatus("saved");
      onSaved();
    } catch {
      setStatus("error");
    }
  }

  function handleBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (valueRef.current !== lastSavedRef.current) {
        save(valueRef.current);
      }
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    if (status !== "saved") {
      return;
    }
    const timer = setTimeout(() => setStatus("idle"), SAVED_INDICATOR_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="notes" className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
          Notes
        </label>
        <span role="status" aria-live="polite" className="font-body text-[11px] text-muted">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <textarea
        id="notes"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
        className="h-[70px] w-full resize-none border border-border bg-surface px-[14px] py-[12px] font-body text-[13px] leading-[1.5] text-ink-2"
      />
      {status === "error" && (
        <ErrorToast message="Could not save note — please try again" onDismiss={() => setStatus("idle")} />
      )}
    </div>
  );
}
