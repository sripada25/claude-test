"use client";

import { useEffect, useState } from "react";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";

function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

interface AccountData {
  fullName: string;
  email: string;
  hasPassword: boolean;
}

// M09-1: "Edit" links to /app/profile (the only place fullName is
// editable) rather than a modal - Account here is a summary, not a second
// editing surface. M09-5: "Change password"/"Set a password" now opens a
// real inline form (ChangePasswordForm), against M09-4's endpoint.
export function AccountSection() {
  const [data, setData] = useState<AccountData | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/profile").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/account").then((response) => (response.ok ? response.json() : null)),
    ]).then(([profile, account]) => {
      if (cancelled || !profile || !account) {
        return;
      }
      setData({ fullName: profile.fullName, email: account.email, hasPassword: account.hasPassword });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="account" className="flex flex-col gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">Account</span>
      <div className="flex flex-col gap-4 border border-border bg-surface p-[18px]">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center bg-accent text-[13px] font-bold text-white"
          >
            {data ? getInitials(data.fullName) : ""}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="truncate font-body text-[13.5px] font-semibold text-ink">{data?.fullName ?? ""}</span>
            <span className="truncate font-mono text-[10.5px] text-muted">{data?.email ?? ""}</span>
          </div>
          <a href="/app/profile" className="shrink-0 font-body text-[12.5px] font-semibold text-accent">
            Edit
          </a>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink-2">Password</span>
          {!changingPassword && (
            <button
              type="button"
              onClick={() => setChangingPassword(true)}
              disabled={!data}
              className="font-body text-[12.5px] font-semibold text-accent disabled:text-muted"
            >
              {data?.hasPassword ? "Change password" : "Set a password"}
            </button>
          )}
        </div>

        {changingPassword && data && (
          <ChangePasswordForm hasPassword={data.hasPassword} onCancel={() => setChangingPassword(false)} />
        )}
      </div>
    </div>
  );
}
