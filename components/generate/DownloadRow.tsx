"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

export function DownloadRow({
  applicationId,
  documentId,
  isPro,
  onDownload,
  onUpgradeRequired,
}: {
  applicationId: string;
  documentId: string;
  isPro: boolean;
  onDownload: () => void;
  onUpgradeRequired: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDownloadClick() {
    if (isPro) {
      onDownload();
    } else {
      onUpgradeRequired();
    }
  }

  async function handleSaveToApplication() {
    setSaving(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/documents/${documentId}/save-to-application`, {
        method: "POST",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      });
    } catch {
      setError("Could not save. Try again.");
      setSaving(false);
      return;
    }

    if (!response.ok) {
      setError("Could not save. Try again.");
      setSaving(false);
      return;
    }

    router.push(`/app/applications/${applicationId}`);
  }

  return (
    <div>
      <div className="flex flex-col-reverse gap-3 max-sm:items-stretch sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleDownloadClick}
          className="flex items-center justify-center gap-[9px] border border-border-strong bg-surface px-[20px] py-[12px] font-body text-[13.5px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <Download size={15} aria-hidden />
          Download
          {!isPro && <Lock size={13} aria-label="Pro feature" />}
        </button>
        <Button variant="primary" onClick={handleSaveToApplication} disabled={saving}>
          {saving ? "Saving..." : "Save to application"}
        </Button>
      </div>
      {error && <p className="mt-2 text-right font-body text-[12px] text-danger">{error}</p>}
    </div>
  );
}
