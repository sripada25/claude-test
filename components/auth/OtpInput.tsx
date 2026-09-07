"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export function OtpInput({
  email,
  onVerified,
}: {
  email: string;
  onVerified: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function verify(code: string) {
    setVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();

      if (result.success) {
        onVerified();
        return;
      }

      if (result.reason === "expired") {
        setError("Code expired — send a new one");
      } else if (result.reason === "locked") {
        setError("Too many attempts. Request a new code.");
      } else {
        setError(`Incorrect code — ${result.attemptsRemaining ?? 0} attempts remaining`);
      }
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (error) {
      setError(null);
    }

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      void verify(next.join(""));
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) {
      return;
    }

    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();

    if (pasted.length === CODE_LENGTH) {
      void verify(pasted);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        setError("Too many attempts. Request a new code.");
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <span
        id="otp-label"
        className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
      >
        Code
      </span>
      <div role="group" aria-labelledby="otp-label" className="flex gap-[6px] sm:gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            disabled={verifying}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            className="size-11 border border-border bg-surface text-center font-mono text-[16px] text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary focus-visible:outline-none"
          />
        ))}
      </div>
      <div aria-live="polite">
        {error && <p className="font-body text-[12px] text-danger">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        className="self-start font-body text-[12px] font-medium text-accent hover:text-accent-hover hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline disabled:hover:no-underline"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </div>
  );
}
