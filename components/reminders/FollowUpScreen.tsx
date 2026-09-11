"use client";

import { useEffect, useState } from "react";
import { GenerateTopBar } from "@/components/generate/GenerateTopBar";
import { DraftPane } from "@/components/reminders/DraftPane";
import { SetReminderAction } from "@/components/reminders/SetReminderAction";
import type { ApplicationReminderSummary } from "@/components/reminders/RemindersTab";

interface ApplicationSummary {
  id: string;
  company: string;
  role: string;
}

export function FollowUpScreen({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [reminders, setReminders] = useState<ApplicationReminderSummary[] | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${applicationId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setApplication(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  // Depends on refreshSignal - resolving a reminder shown here (via
  // DraftPane's Snooze/Dismiss/Mark as sent) should update this list in
  // place, matching DetailScreen's own reminders-refresh pattern rather
  // than forcing a navigation away.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${applicationId}/reminders`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) {
          setReminders(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, refreshSignal]);

  if (!application || !reminders) {
    return null;
  }

  const activeReminders = reminders.filter((r) => r.status === "pending" || r.status === "snoozed");
  const refresh = () => setRefreshSignal((current) => current + 1);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <GenerateTopBar applicationId={application.id} company={application.company} role={application.role} />
      <div className="flex max-w-2xl flex-col gap-5 px-8 py-6">
        {activeReminders.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="font-body text-[13px] text-muted">
              No active follow-up reminder for this application yet.
            </p>
            <SetReminderAction applicationId={applicationId} onCreated={refresh} />
          </div>
        ) : (
          activeReminders.map((reminder) => (
            <DraftPane key={reminder.id} reminderId={reminder.id} onResolved={refresh} />
          ))
        )}
      </div>
    </div>
  );
}
