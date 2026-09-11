"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import type { DocumentType } from "@/components/generate/DocumentTypeToggle";
import { useGenerationPoll, type GeneratedDocumentView } from "@/hooks/useGenerationPoll";

export type { GeneratedDocumentView };

export function GenerateButton({
  applicationId,
  documentType,
  allChecksPass,
  remaining,
  onSucceeded,
  onGeneratingChange,
}: {
  applicationId: string;
  documentType: DocumentType;
  allChecksPass: boolean;
  remaining: number | null;
  onSucceeded: (document: GeneratedDocumentView) => void;
  onGeneratingChange?: (generating: boolean) => void;
}) {
  const { state, trigger } = useGenerationPoll(onSucceeded);

  function handleGenerate() {
    trigger(() =>
      fetch(`/api/applications/${applicationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ type: documentType }),
      }),
    );
  }

  const generating = state === "generating";
  const failed = state === "failed";
  const disabled = !allChecksPass || remaining === 0 || generating;

  useEffect(() => {
    onGeneratingChange?.(generating);
  }, [generating, onGeneratingChange]);

  return (
    <div aria-busy={generating}>
      <Button variant="primary" disabled={disabled} onClick={handleGenerate} className="w-full">
        {generating ? "Generating..." : failed ? "Retry" : "Generate"}
      </Button>
      <p className="font-body text-[11.5px] leading-[1.5] text-muted">
        {failed ? "Generation failed. Try again." : "Takes about 5 seconds. Uses one generation."}
      </p>
    </div>
  );
}
