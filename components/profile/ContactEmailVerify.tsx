"use client";

import { useState } from "react";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

type Stage = "idle" | "sending" | "code" | "verifying";

export function ContactEmailVerify({
  contactEmail,
  verified,
  dirty,
  onVerified,
}: {
  contactEmail: string;
  verified: boolean;
  dirty: boolean;
  onVerified: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (verified && !dirty) {
    return <span className="font-body text-[11px] font-medium text-success">Verified</span>;
  }

  if (!contactEmail || dirty) {
    return null;
  }

  async function handleSend() {
    setStage("sending");
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/profile/contact-email/verify", {
        method: "POST",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      });
    } catch {
      setError("Could not send a code. Try again.");
      setStage("idle");
      return;
    }

    if (response.status === 429) {
      setError("Too many attempts. Try again later.");
      setStage("idle");
      return;
    }

    if (!response.ok) {
      setError("Could not send a code. Try again.");
      setStage("idle");
      return;
    }

    setStage("code");
  }

  async function handleConfirm() {
    if (code.trim() === "") {
      return;
    }

    setStage("verifying");
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/profile/contact-email/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ code }),
      });
    } catch {
      setError("That didn't work. Try again.");
      setStage("code");
      return;
    }

    const result: { success: boolean; reason?: string; attemptsRemaining?: number } = await response
      .json()
      .catch(() => ({ success: false }));

    if (!result.success) {
      if (result.reason === "expired") {
        setError("Code expired — send a new one.");
        setStage("idle");
      } else if (result.reason === "locked") {
        setError("Too many attempts. Send a new code.");
        setStage("idle");
      } else {
        setError(`Incorrect code${result.attemptsRemaining != null ? ` — ${result.attemptsRemaining} attempts remaining` : ""}.`);
        setStage("code");
      }
      setCode("");
      return;
    }

    setStage("idle");
    setCode("");
    onVerified();
  }

  if (stage === "code" || stage === "verifying") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          disabled={stage === "verifying"}
          className="w-24 border border-border-strong bg-surface px-1.5 py-0.5 font-body text-[11px] text-ink"
        />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={stage === "verifying" || code.trim() === ""}
          className="font-body text-[11px] font-medium text-primary disabled:text-muted"
        >
          {stage === "verifying" ? "Checking..." : "Confirm"}
        </button>
        {error && <span className="font-body text-[11px] text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleSend}
        disabled={stage === "sending"}
        className="font-body text-[11px] font-medium text-primary disabled:text-muted"
      >
        {stage === "sending" ? "Sending..." : "Verify"}
      </button>
      {error && <span className="font-body text-[11px] text-danger">{error}</span>}
    </div>
  );
}
