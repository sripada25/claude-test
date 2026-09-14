"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const MIN_PASSWORD_LENGTH = 12;

const FAILURE_COPY: Record<string, string> = {
  incorrect_current_password: "That current password isn't right.",
  weak_password: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  rate_limited: "Too many attempts. Try again later.",
};
const DEFAULT_FAILURE = "Could not change your password. Try again.";

// M09-5: no mockup exists for this - Mockup 09 shows "Change password" as
// a bare link with nothing nested. Plain inline reveal below the row
// (DraftPane's confirming === "dismiss" pattern), not a modal, matching
// this codebase's established convention for un-designed interactions.
export function ChangePasswordForm({ hasPassword, onCancel }: { hasPassword: boolean; onCancel: () => void }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (hasPassword && !currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({
          ...(hasPassword && { currentPassword }),
          newPassword,
        }),
      });
    } catch {
      setSubmitting(false);
      setError(DEFAULT_FAILURE);
      return;
    }

    if (!response.ok) {
      const result: { reason?: string } = await response.json().catch(() => ({}));
      setSubmitting(false);
      setError((result.reason && FAILURE_COPY[result.reason]) ?? DEFAULT_FAILURE);
      return;
    }

    // The endpoint revokes every session, including this one - there's
    // nothing left to do here but sign back in.
    setSuccess(true);
    setTimeout(() => router.push("/signin"), 1500);
  }

  if (success) {
    return (
      <div className="border border-border bg-surface-2 p-3">
        <p className="font-body text-[12.5px] font-semibold text-ink-2">
          Password changed. Signing you out for security — sign back in with your new password.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-border bg-surface-2 p-3">
      {hasPassword && (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] font-semibold text-muted">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10.5px] font-semibold text-muted">New password</span>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10.5px] font-semibold text-muted">Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
        />
      </label>

      {error && <p className="font-body text-[12px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
