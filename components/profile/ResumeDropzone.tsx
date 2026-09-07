"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { ExtractedProfile } from "@/lib/ai/types";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

type DropzoneState = "idle" | "dragover" | "uploading" | "error";

const ERROR_MESSAGE =
  "Couldn't read that file - try again, or fill in your details manually.";

export function ResumeDropzone({
  onParsed,
}: {
  onParsed: (data: ExtractedProfile) => void;
}) {
  const [state, setState] = useState<DropzoneState>("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setState("uploading");

    const body = new FormData();
    body.append("resume", file);

    const response = await fetch("/api/profile/parse-resume", {
      method: "POST",
      headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      body,
    }).catch(() => null);

    const payload = response ? await response.json().catch(() => null) : null;

    if (!response?.ok || !payload?.success) {
      setState("error");
      return;
    }

    setState("idle");
    onParsed(payload.data as ExtractedProfile);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
        Base resume <span className="text-muted">(optional)</span>
      </label>
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setState("idle");
          handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setState("dragover");
        }}
        onDragLeave={() => setState((current) => (current === "dragover" ? "idle" : current))}
        className={`flex h-[64px] cursor-pointer items-center justify-center gap-2 border bg-bg transition-colors duration-150 sm:h-[76px] ${
          state === "dragover"
            ? "border-primary bg-primary-soft"
            : state === "error"
              ? "border-danger"
              : "border-border-strong"
        }`}
      >
        {state === "uploading" ? (
          <>
            <Loader2 size={16} className="animate-spin text-muted" />
            <span className="font-body text-[13px] text-muted">Reading your résumé…</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-muted" />
            <span className="font-body text-[13px] text-muted">
              <span className="hidden sm:inline">Drag a PDF here, or browse</span>
              <span className="sm:hidden">Tap to upload a PDF</span>
            </span>
          </>
        )}
      </div>
      {state === "error" && (
        <p className="font-mono text-[10.5px] text-danger">{ERROR_MESSAGE}</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        aria-label="Upload your résumé as a PDF"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
