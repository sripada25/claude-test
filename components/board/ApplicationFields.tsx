"use client";

import { useState } from "react";
import { STAGES } from "@/components/board/stages";
import { Field } from "@/components/ui/Field";
import { isAllowedUrlScheme } from "@/lib/security/url-scheme";

export interface ApplicationFieldsValues {
  company: string;
  role: string;
  status: string;
  dateApplied: string;
  source: string;
  sourceUrl: string;
}

const SOURCE_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "naukri", label: "Naukri" },
  { value: "indeed", label: "Indeed" },
  { value: "referral", label: "Referral" },
  { value: "company_site", label: "Company site" },
  { value: "other", label: "Other" },
];

const SOURCE_URL_DOMAINS: Record<string, string> = {
  "linkedin.com": "linkedin",
  "naukri.com": "naukri",
  "indeed.com": "indeed",
};

const SELECT_CLASSES =
  "w-full border border-border bg-surface px-[13px] py-[11px] font-body text-[13.5px] text-ink";

const LABEL_CLASSES = "font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2";

function inferSourceFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, source] of Object.entries(SOURCE_URL_DOMAINS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return source;
      }
    }
  } catch {
    // Not a valid URL yet - nothing to infer.
  }
  return null;
}

export function ApplicationFields({
  values,
  onChange,
}: {
  values: ApplicationFieldsValues;
  onChange: (patch: Partial<ApplicationFieldsValues>) => void;
}) {
  const [sourceUrlError, setSourceUrlError] = useState<string | undefined>();
  const [sourceTouched, setSourceTouched] = useState(false);

  function handleSourceUrlBlur() {
    const url = values.sourceUrl.trim();
    if (!url) {
      setSourceUrlError(undefined);
      return;
    }
    if (!isAllowedUrlScheme(url)) {
      setSourceUrlError("Enter a valid http or https URL");
      return;
    }
    setSourceUrlError(undefined);
    if (!sourceTouched) {
      const inferred = inferSourceFromUrl(url);
      if (inferred) {
        onChange({ source: inferred });
      }
    }
  }

  return (
    <>
      <Field
        id="company"
        label="Company"
        name="company"
        value={values.company}
        onChange={(value) => onChange({ company: value })}
        required
      />
      <Field
        id="role"
        label="Role"
        name="role"
        value={values.role}
        onChange={(value) => onChange({ role: value })}
        required
      />
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex w-full flex-col gap-[7px]">
          <label htmlFor="status" className={LABEL_CLASSES}>
            Status
          </label>
          <select
            id="status"
            value={values.status}
            onChange={(event) => onChange({ status: event.target.value })}
            className={SELECT_CLASSES}
          >
            {STAGES.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="date-applied"
          label="Date applied"
          name="dateApplied"
          type="date"
          value={values.dateApplied}
          onChange={(value) => onChange({ dateApplied: value })}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex w-full flex-col gap-[7px]">
          <label htmlFor="source" className={LABEL_CLASSES}>
            Source
          </label>
          <select
            id="source"
            value={values.source}
            onChange={(event) => {
              setSourceTouched(true);
              onChange({ source: event.target.value });
            }}
            className={SELECT_CLASSES}
          >
            <option value="">Select…</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="source-url"
          label="Source URL"
          name="sourceUrl"
          type="url"
          value={values.sourceUrl}
          onChange={(value) => onChange({ sourceUrl: value })}
          onBlur={handleSourceUrlBlur}
          error={sourceUrlError}
        />
      </div>
    </>
  );
}
