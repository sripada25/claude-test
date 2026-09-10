"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import type { GeneratedDocumentView } from "@/hooks/useGenerationPoll";

const CARD_CLASS = "border border-border bg-surface px-7 py-[26px] max-md:px-4 max-md:py-4";

export function ResultCard({
  content,
  generating,
  documentId,
  editing,
  onToggleEdit,
  onSaved,
}: {
  content: string | null;
  generating: boolean;
  documentId: string;
  editing: boolean;
  onToggleEdit: () => void;
  onSaved: (document: GeneratedDocumentView) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(content ?? "");
      setSaveError(null);
    }
  }, [editing, content]);

  async function handleSave() {
    if (draft.trim() === "") {
      return;
    }

    setSaving(true);
    setSaveError(null);

    let response: Response;
    try {
      response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ content: draft }),
      });
    } catch {
      setSaveError("Could not save your changes. Try again.");
      setSaving(false);
      return;
    }

    if (!response.ok) {
      setSaveError("Could not save your changes. Try again.");
      setSaving(false);
      return;
    }

    const document = await response.json();
    setSaving(false);
    onSaved(document);
    onToggleEdit();
  }

  function handleCancel() {
    setSaveError(null);
    onToggleEdit();
  }

  if (generating) {
    return (
      <div aria-live="polite" className={CARD_CLASS}>
        <div className="flex flex-col gap-[14px]" aria-hidden>
          <div className="h-4 w-1/3 animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-2/3 animate-pulse bg-surface-2" />
        </div>
      </div>
    );
  }

  if (content === null) {
    return null;
  }

  if (editing) {
    return (
      <div aria-live="polite" className={CARD_CLASS}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={12}
          className="w-full resize-y bg-transparent font-body text-[13px] leading-[1.6] text-ink-2 focus-visible:outline-none"
        />
        {saveError && <p className="mt-2 font-body text-[12px] text-danger">{saveError}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || draft.trim() === ""}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <article
      aria-live="polite"
      className={`whitespace-pre-line font-body text-[13px] leading-[1.6] text-ink-2 ${CARD_CLASS}`}
    >
      {content}
    </article>
  );
}
