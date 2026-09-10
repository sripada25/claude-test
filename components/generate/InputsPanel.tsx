import { Check } from "lucide-react";

export interface InputsPanelProps {
  profileComplete: boolean;
  jobDescriptionSaved: boolean;
  emailVerified: boolean;
}

interface Row {
  label: string;
  ok: boolean;
  successText: string;
  failureText: string;
  failureColorClass: string;
}

export function InputsPanel({ profileComplete, jobDescriptionSaved, emailVerified }: InputsPanelProps) {
  const rows: Row[] = [
    {
      label: "Your profile",
      ok: profileComplete,
      successText: "Complete",
      failureText: "Incomplete — add target role and skills",
      failureColorClass: "text-danger",
    },
    {
      label: "Job description",
      ok: jobDescriptionSaved,
      successText: "Snapshot saved",
      failureText: "No job description",
      failureColorClass: "text-warning",
    },
    {
      label: "Email",
      ok: emailVerified,
      successText: "Verified",
      failureText: "Verify your email",
      failureColorClass: "text-danger",
    },
  ];

  return (
    <dl className="border border-border bg-surface">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-[14px] py-3 ${
            index > 0 ? "border-t border-border" : ""
          }`}
        >
          <dt className="font-body text-[13px] font-normal text-ink">{row.label}</dt>
          <dd>
            {row.ok ? (
              <span className="inline-flex items-center gap-1 bg-success-soft px-[7px] py-[3px]">
                <Check size={10} className="text-success" aria-hidden />
                <span className="font-mono text-[9.5px] font-semibold text-success">{row.successText}</span>
              </span>
            ) : (
              <span className={`font-body text-[13px] font-normal ${row.failureColorClass}`}>{row.failureText}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
