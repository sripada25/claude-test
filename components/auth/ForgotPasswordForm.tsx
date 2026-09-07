"use client";

import { type FormEvent, useState } from "react";
import { EmailField } from "@/components/auth/EmailField";
import { PasswordField } from "@/components/auth/PasswordField";
import { SignInButton } from "@/components/auth/SignInButton";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

type Step = "email" | "reset";

function mapResetError(reason: string, attemptsRemaining?: number): string {
  switch (reason) {
    case "weak_password":
      return "Use at least 12 characters.";
    case "expired":
      return "Code expired — send a new one";
    case "locked":
      return "Too many attempts. Request a new code.";
    default:
      return `Incorrect code — ${attemptsRemaining ?? 0} attempts remaining`;
  }
}

export function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || email.trim() === "") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        setError("Too many requests. Try again in a few minutes.");
        return;
      }

      // Always the same response, whether or not the account exists.
      setMessage("If that address has an account, we've sent a code.");
      setStep("reset");
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || code.trim().length !== 6 || newPassword.trim() === "") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const result = await response.json();

      if (!result.success) {
        setError(mapResetError(result.reason, result.attemptsRemaining));
        return;
      }

      onSuccess();
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <form className="mt-[26px] flex w-full flex-col gap-4" onSubmit={handleSendCode}>
        <EmailField value={email} onChange={setEmail} />
        {error && (
          <p role="alert" className="font-body text-[12px] text-danger">
            {error}
          </p>
        )}
        <SignInButton loading={loading} canSubmit={email.trim() !== ""} label="Send code" />
      </form>
    );
  }

  return (
    <form className="mt-[26px] flex w-full flex-col gap-4" onSubmit={handleReset}>
      {message && <p className="font-body text-[12px] text-ink-2">{message}</p>}
      <div className="flex w-full flex-col gap-[7px]">
        <label
          htmlFor="reset-code"
          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
        >
          Code
        </label>
        <input
          id="reset-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full border border-border bg-surface px-[13px] py-[11px] text-center font-mono text-[16px] tracking-[4px] text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary focus-visible:outline-none"
        />
      </div>
      <PasswordField mode="signup" value={newPassword} onChange={setNewPassword} />
      {error && (
        <p role="alert" className="font-body text-[12px] text-danger">
          {error}
        </p>
      )}
      <SignInButton
        loading={loading}
        canSubmit={code.trim().length === 6 && newPassword.trim() !== ""}
        label="Reset password"
      />
    </form>
  );
}
