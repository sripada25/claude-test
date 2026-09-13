"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";
import { SnoozeControl } from "./SnoozeControl";

const CARD_CLASS = "border border-border bg-surface px-7 py-[26px] max-md:px-4 max-md:py-4";

type PaneState = "loading" | "ready" | "error";
type ConfirmingAction = "dismiss" | "sent" | null;

interface ApplicationInfo {
  company: string;
  role: string;
  contactEmail: string | null;
}

const SEND_FAILURE_COPY: Record<string, string> = {
  quota_exceeded:
    "Couldn't send this email — we've hit today's sending limit. Try again tomorrow, or copy the draft and send it yourself.",
};
const DEFAULT_SEND_FAILURE =
  "Couldn't send this email. Check the address or copy the draft and send it yourself.";

export function DraftPane({
  reminderId,
  applicationId,
  tier,
  onResolved,
}: {
  reminderId: string;
  applicationId: string;
  tier: "free" | "pro";
  onResolved?: () => void;
}) {
  const [state, setState] = useState<PaneState>("loading");
  const [application, setApplication] = useState<ApplicationInfo | null>(null);
  const [senderVerified, setSenderVerified] = useState(false);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [savingTo, setSavingTo] = useState(false);
  const [subject, setSubject] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmingAction>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendFailed, setSendFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setEditing(false);

    Promise.all([
      fetch(`/api/reminders/${reminderId}/draft`, {
        method: "POST",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      }).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/applications/${applicationId}`).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/profile`).then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(
        ([draftData, applicationData, profileData]: [
          { draftContent: string },
          ApplicationInfo,
          { contactEmailVerifiedAt: string | null },
        ]) => {
          if (cancelled) {
            return;
          }
          setContent(draftData.draftContent);
          setDraft(draftData.draftContent);
          setApplication(applicationData);
          setTo(applicationData.contactEmail ?? "");
          setSubject(`Following up — ${applicationData.role}`);
          setSenderVerified(profileData.contactEmailVerifiedAt !== null);
          setState("ready");
        },
      )
      .catch(() => {
        if (!cancelled) {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reminderId, applicationId]);

  async function handleSaveDraft() {
    if (draft.trim() === "") {
      return;
    }

    setSaving(true);
    setSaveError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}/draft`, {
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

    const data: { draftContent: string } = await response.json();
    setContent(data.draftContent);
    setDraft(data.draftContent);
    setSaving(false);
    setEditing(false);
  }

  function handleCancelEdit() {
    setDraft(content);
    setSaveError(null);
    setEditing(false);
  }

  // To persists via the existing PATCH /api/applications/:id (extended
  // with contactEmail this task) on blur - Subject is derived, client-side
  // text with no persistence, same status as the body before it's saved.
  async function handleToBlur() {
    if (to === (application?.contactEmail ?? "")) {
      return;
    }

    setSavingTo(true);
    try {
      await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ contactEmail: to || null }),
      });
      setApplication((current) => (current ? { ...current, contactEmail: to || null } : current));
    } finally {
      setSavingTo(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied - nothing more to do silently.
    }
  }

  function handleOpenInMail() {
    const params = new URLSearchParams();
    if (subject) {
      params.set("subject", subject);
    }
    params.set("body", draft);
    window.location.href = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
  }

  async function handleDismiss() {
    setActionPending(true);
    setActionError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ action: "dismiss" }),
      });
    } catch {
      setActionError("Could not dismiss this reminder. Try again.");
      setActionPending(false);
      return;
    }

    setActionPending(false);
    if (!response.ok) {
      setActionError("Could not dismiss this reminder. Try again.");
      return;
    }

    setConfirming(null);
    onResolved?.();
  }

  async function handleSendNow() {
    setActionPending(true);
    setActionError(null);
    setSendFailed(false);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ subject }),
      });
    } catch {
      setActionPending(false);
      setSendFailed(true);
      setActionError(DEFAULT_SEND_FAILURE);
      return;
    }

    setActionPending(false);
    if (!response.ok) {
      const result: { reason?: string } = await response.json().catch(() => ({}));
      setSendFailed(true);
      setActionError((result.reason && SEND_FAILURE_COPY[result.reason]) ?? DEFAULT_SEND_FAILURE);
      return;
    }

    setConfirming(null);
    onResolved?.();
  }

  if (state === "loading") {
    return (
      <div aria-live="polite" className={CARD_CLASS}>
        <div className="flex flex-col gap-[14px]" aria-hidden>
          <div className="h-4 w-1/3 animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse bg-surface-2" />
        </div>
      </div>
    );
  }

  if (state === "error" || !application) {
    return (
      <div className={CARD_CLASS}>
        <p className="font-body text-[13px] text-danger">Could not load this draft.</p>
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-[16px] font-semibold text-ink">Follow up — {application.company}</span>
        <div className="flex items-center gap-2">
          <SnoozeControl reminderId={reminderId} onResolved={onResolved} />
          {confirming !== "dismiss" && (
            <button
              type="button"
              onClick={() => setConfirming("dismiss")}
              className="border border-border-strong bg-surface px-[12px] py-[7px] font-body text-[12px] font-medium text-ink"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {confirming === "dismiss" && (
        <div className="flex flex-wrap items-center gap-[10px] border border-border bg-surface-2 p-3">
          <span className="font-body text-[12px] font-semibold text-ink-2">
            Dismiss? You won&apos;t be reminded about this again.
          </span>
          <Button variant="secondary" size="sm" onClick={handleDismiss} disabled={actionPending}>
            {actionPending ? "Dismissing..." : "Confirm"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)} disabled={actionPending}>
            Cancel
          </Button>
        </div>
      )}

      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">
        Drafted message
      </span>

      <div className="flex flex-col gap-[14px] border border-border bg-surface p-5">
        <div className="flex flex-col gap-[10px]">
          <div className="flex items-center gap-[14px]">
            <span className="w-16 shrink-0 font-mono text-[10.5px] font-semibold text-muted">To</span>
            <input
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              onBlur={handleToBlur}
              disabled={savingTo}
              placeholder="recipient@example.com"
              className="flex-1 border border-border bg-bg px-[10px] py-[7px] font-body text-[12.5px] text-ink"
            />
          </div>
          <div className="flex items-center gap-[14px]">
            <span className="w-16 shrink-0 font-mono text-[10.5px] font-semibold text-muted">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="flex-1 border border-border bg-bg px-[10px] py-[7px] font-body text-[12.5px] text-ink"
            />
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={10}
              className="w-full resize-y border border-border-strong bg-surface p-2 font-body text-[13px] leading-[1.6] text-ink-2 focus-visible:outline-none"
            />
            {saveError && <p className="font-body text-[12px] text-danger">{saveError}</p>}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleSaveDraft} disabled={saving || draft.trim() === ""}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-line font-body text-[13px] leading-[1.6] text-ink-2">{draft}</p>
        )}
      </div>

      {actionError && <p className="font-body text-[12px] text-danger">{actionError}</p>}

      {confirming === "sent" ? (
        <div className="flex flex-wrap items-center gap-[10px] border-t border-border pt-4">
          <span className="font-body text-[12px] font-semibold text-ink-2">
            Send this email now? It&apos;ll go to {to} from Trackr&apos;s mail service. You can&apos;t unsend it.
          </span>
          <Button variant="primary" size="sm" onClick={handleSendNow} disabled={actionPending}>
            {actionPending ? "Sending..." : "Send"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)} disabled={actionPending}>
            Cancel
          </Button>
        </div>
      ) : (
        !editing && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="max-w-[260px] font-body text-[11.5px] leading-[1.4] text-muted">
              Sends from Trackr on your behalf — or copy it and send it yourself.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="px-[14px]" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="secondary" size="sm" className="px-[14px]" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="px-[14px]"
                onClick={handleOpenInMail}
                disabled={!to}
              >
                Open in mail ↗
              </Button>
              {tier === "pro" &&
                (senderVerified ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Send size={14} aria-hidden />}
                    onClick={sendFailed ? handleSendNow : () => setConfirming("sent")}
                    disabled={!to || actionPending}
                  >
                    {actionPending ? "Sending..." : sendFailed ? "Retry send" : "Send now"}
                  </Button>
                ) : (
                  <span className="font-body text-[12px] text-muted">
                    <a href="/app/profile" className="font-medium text-primary underline">
                      Verify your contact email
                    </a>{" "}
                    to enable sending
                  </span>
                ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
