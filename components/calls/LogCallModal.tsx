"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import type { StructuredNote } from "@/lib/ai/types";

type ModalState = "form" | "structuring" | "reviewing";

const PANEL_CLASS =
  "relative flex w-full max-w-[480px] flex-col gap-4 border border-border-strong bg-surface p-6 shadow-[0_12px_36px_rgba(21,24,28,0.18)]";

export function LogCallModal({
  applicationId,
  onClose,
  onLogged,
}: {
  applicationId: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const [state, setState] = useState<ModalState>("form");
  const [question1Answer, setQuestion1Answer] = useState("");
  const [question2Answer, setQuestion2Answer] = useState("");
  const [question3Answer, setQuestion3Answer] = useState("");
  const [draft, setDraft] = useState<StructuredNote | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answersComplete = question1Answer.trim() !== "" && question2Answer.trim() !== "" && question3Answer.trim() !== "";

  async function handleStructureWithAi() {
    setState("structuring");
    setStructureError(null);

    let response: Response;
    try {
      response = await fetch(`/api/applications/${applicationId}/call-notes/structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ question1Answer, question2Answer, question3Answer }),
      });
    } catch {
      setStructureError("Could not reach the AI. Try again.");
      setState("form");
      return;
    }

    if (!response.ok) {
      setStructureError("Could not structure this call. Try again.");
      setState("form");
      return;
    }

    const note: StructuredNote = await response.json();
    setDraft(note);
    setState("reviewing");
  }

  function handleDiscardDraft() {
    setDraft(null);
    setSaveError(null);
    setState("form");
  }

  async function saveCall(structured?: StructuredNote) {
    setSaving(true);
    setSaveError(null);

    let response: Response;
    try {
      response = await fetch(`/api/applications/${applicationId}/call-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ question1Answer, question2Answer, question3Answer, structured }),
      });
    } catch {
      setSaveError("Could not save this call log. Try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    if (!response.ok) {
      setSaveError("Could not save this call log. Try again.");
      return;
    }

    onLogged?.();
    onClose();
  }

  function updateDraftField<K extends keyof StructuredNote>(key: K, value: StructuredNote[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Log a call" className={PANEL_CLASS}>
          <div className="flex items-center justify-between">
            <span className="font-body text-[15px] font-semibold text-ink">Log a call</span>
            <button type="button" onClick={onClose} aria-label="Close" className="text-muted">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
                1 · Who called?
              </span>
              <textarea
                ref={firstFieldRef}
                value={question1Answer}
                onChange={(event) => setQuestion1Answer(event.target.value)}
                rows={2}
                disabled={state !== "form"}
                className="w-full resize-y border border-border-strong bg-surface p-2 font-body text-[13px] text-ink"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
                2 · What was discussed?
              </span>
              <textarea
                value={question2Answer}
                onChange={(event) => setQuestion2Answer(event.target.value)}
                rows={3}
                disabled={state !== "form"}
                className="w-full resize-y border border-border-strong bg-surface p-2 font-body text-[13px] text-ink"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
                3 · What&apos;s the next step?
              </span>
              <textarea
                value={question3Answer}
                onChange={(event) => setQuestion3Answer(event.target.value)}
                rows={2}
                disabled={state !== "form"}
                className="w-full resize-y border border-border-strong bg-surface p-2 font-body text-[13px] text-ink"
              />
            </label>
          </div>

          {structureError && <p className="font-body text-[12px] text-danger">{structureError}</p>}

          {state === "form" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => saveCall(undefined)}
                disabled={!answersComplete || saving}
              >
                {saving ? "Saving..." : "Save as plain note"}
              </Button>
              <Button variant="primary" size="sm" onClick={handleStructureWithAi} disabled={!answersComplete}>
                Structure with AI
              </Button>
            </div>
          )}

          {state === "structuring" && (
            <div aria-live="polite" className="flex flex-col gap-2" aria-busy="true">
              <div className="h-3 w-1/3 animate-pulse bg-surface-2" />
              <div className="h-3 w-full animate-pulse bg-surface-2" />
              <div className="h-3 w-2/3 animate-pulse bg-surface-2" />
            </div>
          )}

          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: state === "reviewing" && draft ? "1fr" : "0fr" }}
          >
            <div className="flex flex-col gap-3 overflow-hidden">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
                AI draft — check before saving
              </span>

              {draft && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-body text-[11px] text-muted">Contact name</span>
                      <input
                        type="text"
                        value={draft.contactName ?? ""}
                        onChange={(event) => updateDraftField("contactName", event.target.value || null)}
                        className="border border-border-strong bg-surface px-2 py-[6px] font-body text-[12.5px] text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-body text-[11px] text-muted">Contact role</span>
                      <input
                        type="text"
                        value={draft.contactRole ?? ""}
                        onChange={(event) => updateDraftField("contactRole", event.target.value || null)}
                        className="border border-border-strong bg-surface px-2 py-[6px] font-body text-[12.5px] text-ink"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="font-body text-[11px] text-muted">Salary</span>
                    <input
                      type="text"
                      value={draft.salaryMentioned ?? ""}
                      onChange={(event) => updateDraftField("salaryMentioned", event.target.value || null)}
                      className="border border-border-strong bg-surface px-2 py-[6px] font-body text-[12.5px] text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-body text-[11px] text-muted">Next step</span>
                    <input
                      type="text"
                      value={draft.nextStep ?? ""}
                      onChange={(event) => updateDraftField("nextStep", event.target.value || null)}
                      className="border border-border-strong bg-surface px-2 py-[6px] font-body text-[12.5px] text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-body text-[11px] text-muted">Follow up on</span>
                    <input
                      type="date"
                      value={draft.followUpDate ?? ""}
                      onChange={(event) => updateDraftField("followUpDate", event.target.value || null)}
                      className="border border-border-strong bg-surface px-2 py-[6px] font-body text-[12.5px] text-ink"
                    />
                  </label>
                  {draft.followUpDate && (
                    <p className="font-body text-[11.5px] text-muted">Sets a reminder and updates the application.</p>
                  )}

                  {saveError && <p className="font-body text-[12px] text-danger">{saveError}</p>}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={handleDiscardDraft} disabled={saving}>
                      Discard and re-answer
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => saveCall(draft)} disabled={saving}>
                      {saving ? "Saving..." : "Save call log"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
