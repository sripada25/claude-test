"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentType } from "@/components/generate/DocumentTypeToggle";

const POLL_INTERVAL_MS = 2000;

export interface GeneratedDocumentView {
  id: string;
  type: DocumentType;
  content: string;
  createdAt: string;
}

export type GenerationPollState = "idle" | "generating" | "failed";

// Shared by GenerateButton (initial generation) and ResultActions's Regenerate -
// both enqueue a job at a different endpoint but poll the identical
// GET /api/generate/:jobId/status contract (L109: regenerate is the same
// pattern as the initial generate call, full price, same retry semantics).
export function useGenerationPoll(onSucceeded: (document: GeneratedDocumentView) => void) {
  const [state, setState] = useState<GenerationPollState>("idle");
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

  const trigger = useCallback(
    async (enqueue: () => Promise<Response>) => {
      setState("generating");

      let response: Response;
      try {
        response = await enqueue();
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
    },
    [pollStatus],
  );

  return { state, trigger };
}
