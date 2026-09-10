"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GenerateTopBar } from "@/components/generate/GenerateTopBar";
import { QuotaBadge } from "@/components/generate/QuotaBadge";
import { DocumentTypeToggle, type DocumentType } from "@/components/generate/DocumentTypeToggle";
import { InputsPanel } from "@/components/generate/InputsPanel";
import { GenerateButton } from "@/components/generate/GenerateButton";
import { ResultActions } from "@/components/generate/ResultActions";
import { ResultCard } from "@/components/generate/ResultCard";
import { DownloadRow } from "@/components/generate/DownloadRow";
import { PaywallPanel } from "@/components/generate/PaywallPanel";
import type { GeneratedDocumentView } from "@/hooks/useGenerationPoll";

interface ApplicationSummary {
  id: string;
  company: string;
  role: string;
  jobDescription: string | null;
}

interface ProfileSummary {
  completedAt: string | null;
}

interface SubscriptionSummary {
  tier: "free" | "pro";
  emailVerified: boolean;
  quotaExhausted: boolean;
  generationsUsed: number;
  generationsLimit: number | null;
  resetDate: string | null;
}

function initialDocumentType(searchParams: URLSearchParams): DocumentType {
  return searchParams.get("type") === "resume" ? "resume" : "cover_letter";
}

export function GenerateScreen({ applicationId }: { applicationId: string }) {
  const searchParams = useSearchParams();

  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(() => initialDocumentType(searchParams));
  const [result, setResult] = useState<GeneratedDocumentView | null>(null);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const refreshSubscription = useCallback(() => {
    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setSubscription(data);
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${applicationId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setApplication(data);
        }
      });

    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setProfile(data);
        }
      });

    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setSubscription(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (!application || !profile || !subscription) {
    return null;
  }

  const profileComplete = profile.completedAt !== null;
  const jobDescriptionSaved = application.jobDescription !== null && application.jobDescription.trim() !== "";
  const allChecksPass = profileComplete && jobDescriptionSaved && subscription.emailVerified;
  const remaining =
    subscription.generationsLimit === null
      ? null
      : Math.max(subscription.generationsLimit - subscription.generationsUsed, 0);
  const showPaywall =
    !result && subscription.tier === "free" && subscription.quotaExhausted && subscription.resetDate !== null;

  function handleGenerated(newDocument: GeneratedDocumentView) {
    setResult(newDocument);
    setEditing(false);
    refreshSubscription();
  }

  function handleSaved(updatedDocument: GeneratedDocumentView) {
    setResult(updatedDocument);
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <GenerateTopBar applicationId={application.id} company={application.company} role={application.role} />
      <div className="flex justify-end px-8 py-4">
        <QuotaBadge
          tier={subscription.tier}
          generationsUsed={subscription.generationsUsed}
          generationsLimit={subscription.generationsLimit}
        />
      </div>
      <div className="flex flex-1 flex-col gap-[22px] px-8 pb-8 lg:flex-row">
        <div className="flex w-full flex-col gap-5 lg:w-[246px] lg:shrink-0">
          <DocumentTypeToggle value={documentType} onChange={setDocumentType} />
          <InputsPanel
            profileComplete={profileComplete}
            jobDescriptionSaved={jobDescriptionSaved}
            emailVerified={subscription.emailVerified}
          />
          <GenerateButton
            applicationId={application.id}
            documentType={documentType}
            allChecksPass={allChecksPass}
            remaining={remaining}
            onSucceeded={handleGenerated}
            onGeneratingChange={setGenerating}
          />
        </div>
        <div className="flex w-full flex-col gap-4 lg:flex-1">
          {showPaywall ? (
            <PaywallPanel
              limit={subscription.generationsLimit ?? 0}
              resetDate={subscription.resetDate ?? ""}
              onUpgrade={() => {}}
            />
          ) : (
            (generating || result) && (
              <>
                <ResultCard
                  content={result?.content ?? null}
                  generating={generating}
                  documentId={result?.id ?? ""}
                  editing={editing}
                  onToggleEdit={() => setEditing((current) => !current)}
                  onSaved={handleSaved}
                />
                {result && (
                  <>
                    <ResultActions
                      documentId={result.id}
                      remaining={remaining}
                      editing={editing}
                      onToggleEdit={() => setEditing((current) => !current)}
                      onRegenerateSucceeded={handleGenerated}
                    />
                    <DownloadRow
                      applicationId={application.id}
                      documentId={result.id}
                      isPro={subscription.tier === "pro"}
                      onDownload={() => {}}
                      onUpgradeRequired={() => {}}
                    />
                  </>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
