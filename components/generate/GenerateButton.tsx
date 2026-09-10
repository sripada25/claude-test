"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import type { DocumentType } from "@/components/generate/DocumentTypeToggle";

const POLL_INTERVAL_MS = 2000;

export interface GeneratedDocumentView {
  id: string;
  type: DocumentType;
  content: string;
  createdAt: string;
}

type GenerationState = "idle" | "generating" | "failed";

export function GenerateButton({
  applicationId,
  documentType,
  allChecksPass,
  remaining,
  onSucceeded,
}: {
  applicationId: string;
  documentType: DocumentType;
  allChecksPass: boolean;
  remaining: number | null;
  onSucceeded: (document: GeneratedDocumentView) => void;
}) {
  const [state, setState] = useState<GenerationState>("idle");
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const pollStatus = useCallback(
    (jobId: string) => {
      async function tick() {
        let response: Response;
        try {
          response = await fetch(`/api/generate/${jobId}/status`);
        } catch {
          if (!cancelledRef.current) {
            setState("failed");
          }
          return;
        }

        if (cancelledRef.current) {
          return;
        }

        if (!response.ok) {
          setState("failed");
          return;
        }

        const data = await response.json();

        if (data.status === "succeeded") {
          setState("idle");
          onSucceeded(data.document);
          return;
        }

        if (data.status === "failed") {
          setState("failed");
          return;
        }

        pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }

      tick();
    },
    [onSucceeded],
  );

  async function handleGenerate() {
    setState("generating");

    let response: Response;
    try {
      response = await fetch(`/api/applications/${applicationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ type: documentType }),
      });
    } catch {
      setState("failed");
      return;
    }

    if (!response.ok) {
      setState("failed");
      return;
    }

    const data = await response.json();
    pollStatus(data.jobId);
  }

  const generating = state === "generating";
  const failed = state === "failed";
  const disabled = !allChecksPass || remaining === 0 || generating;

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
