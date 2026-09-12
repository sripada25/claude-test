import type { ReactNode } from "react";
import { Field } from "@/components/ui/Field";

export type ProfileFieldsValues = {
  fullName: string;
  currentRole: string;
  targetRole: string;
  yearsExperience: string;
  monthsExperience: string;
  contactEmail: string;
};

const SELECT_CLASSES =
  "w-full border border-border bg-surface px-[13px] py-[11px] font-body text-[13.5px] text-ink";

export function ProfileFields({
  values,
  onChange,
  errors,
  contactEmailAction,
}: {
  values: ProfileFieldsValues;
  onChange: (patch: Partial<ProfileFieldsValues>) => void;
  errors?: { fullName?: string; targetRole?: string };
  contactEmailAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="full-name"
          label="Full name"
          name="fullName"
          value={values.fullName}
          onChange={(value) => onChange({ fullName: value })}
          required
          error={errors?.fullName}
        />
        <Field
          id="current-role"
          label="Current role"
          name="currentRole"
          value={values.currentRole}
          onChange={(value) => onChange({ currentRole: value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-[7px]">
          <label className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
            Experience
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Years of experience"
              value={values.yearsExperience}
              onChange={(event) => onChange({ yearsExperience: event.target.value })}
              className={SELECT_CLASSES}
            >
              {Array.from({ length: 61 }, (_, i) => (
                <option key={i} value={i}>
                  {i} yr
                </option>
              ))}
            </select>
            <select
              aria-label="Months of experience"
              value={values.monthsExperience}
              onChange={(event) => onChange({ monthsExperience: event.target.value })}
              className={SELECT_CLASSES}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {i} mo
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field
          id="target-role"
          label="Target role"
          name="targetRole"
          value={values.targetRole}
          onChange={(value) => onChange({ targetRole: value })}
          required
          error={errors?.targetRole}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="contact-email"
          label="Contact email"
          type="email"
          name="contactEmail"
          value={values.contactEmail}
          onChange={(value) => onChange({ contactEmail: value })}
          hint="Used as the reply-to address when Trackr sends a follow-up on your behalf."
          labelAction={contactEmailAction}
        />
      </div>
    </div>
  );
}
