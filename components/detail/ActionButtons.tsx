"use client";

import { FilePlus, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SetReminderAction } from "@/components/reminders/SetReminderAction";
import { LogCallModal } from "@/components/calls/LogCallModal";

function useGenerationGate() {
  const [completedAt, setCompletedAt] = useState<string | null | undefined>(undefined);
  const [emailVerified, setEmailVerified] = useState<boolean | undefined>(undefined);
  const [quotaExhausted, setQuotaExhausted] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setCompletedAt(data?.completedAt ?? null);
        }
      });

    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setEmailVerified(Boolean(data?.emailVerified));
          setQuotaExhausted(Boolean(data?.quotaExhausted));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (emailVerified === undefined || completedAt === undefined || quotaExhausted === undefined) {
    return undefined;
  }
  if (!emailVerified) {
    return "Verify your email to start generating";
  }
  if (!completedAt) {
    return "Complete your profile to generate";
  }
  if (quotaExhausted) {
    return "0 generations left this month";
  }
  return null;
}

export function ActionButtons({
  applicationId,
  onReminderCreated,
  onCallLogged,
}: {
  applicationId: string;
  onReminderCreated?: () => void;
  onCallLogged?: () => void;
}) {
  const router = useRouter();
  const disabledReason = useGenerationGate();
  const generationDisabled = disabledReason !== null && disabledReason !== undefined;
  const [loggingCall, setLoggingCall] = useState(false);

  return (
    <div className="flex flex-col gap-[10px]">
      <Button
        variant="primary"
        size="md"
        icon={<FilePlus size={15} aria-hidden />}
        disabled={generationDisabled}
        aria-describedby={generationDisabled ? "generation-blocked-reason" : undefined}
        onClick={() => router.push(`/app/applications/${applicationId}/generate?type=cover_letter`)}
      >
        Generate cover letter
      </Button>
      <Button
        variant="primary"
        size="md"
        icon={<FilePlus size={15} aria-hidden />}
        disabled={generationDisabled}
        aria-describedby={generationDisabled ? "generation-blocked-reason" : undefined}
        onClick={() => router.push(`/app/applications/${applicationId}/generate?type=resume`)}
      >
        Generate resume
      </Button>
      {generationDisabled && (
        <p id="generation-blocked-reason" className="font-body text-[12px] text-muted">
          {disabledReason}
        </p>
      )}
      <Button
        variant="secondary"
        size="md"
        icon={<PhoneCall size={15} aria-hidden />}
        onClick={() => setLoggingCall(true)}
      >
        Log a call
      </Button>
      <SetReminderAction applicationId={applicationId} onCreated={onReminderCreated} />
      {loggingCall && (
        <LogCallModal
          applicationId={applicationId}
          onClose={() => setLoggingCall(false)}
          onLogged={onCallLogged}
        />
      )}
    </div>
  );
}
