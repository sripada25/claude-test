"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EmploymentHistoryFields,
  type EmploymentEntryErrors,
  type EmploymentEntryForm,
} from "@/components/profile/EmploymentHistoryFields";
import { LocationSegmented, type LocationPreference } from "@/components/profile/LocationSegmented";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { ProfileFields, type ProfileFieldsValues } from "@/components/profile/ProfileFields";
import { ResumeDropzone } from "@/components/profile/ResumeDropzone";
import { SalaryField, type SalaryValues } from "@/components/profile/SalaryField";
import { SkillsTagInput } from "@/components/profile/SkillsTagInput";
import { SkipLink } from "@/components/profile/SkipLink";
import { StepChip } from "@/components/profile/StepChip";
import { BrandMark } from "@/components/ui/BrandMark";
import type { ExtractedProfile } from "@/lib/ai/types";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const EMPTY_PROFILE_FORM: ProfileFieldsValues = {
  fullName: "",
  currentRole: "",
  targetRole: "",
  yearsExperience: "0",
  monthsExperience: "0",
};

export function ProfileBuilderScreen() {
  const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFieldsValues>(EMPTY_PROFILE_FORM);
  const [skills, setSkills] = useState<string[]>([]);
  const [employmentHistory, setEmploymentHistory] = useState<EmploymentEntryForm[]>([]);
  const [salary, setSalary] = useState<SalaryValues>({ currency: "INR", amount: "", period: "" });
  const [locationPreference, setLocationPreference] = useState<LocationPreference | "">("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    targetRole?: string;
    skills?: string;
  }>({});
  const [employmentErrors, setEmploymentErrors] = useState<EmploymentEntryErrors[]>([]);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!extractedProfile) {
      return;
    }

    setProfileForm((current) => ({
      fullName: extractedProfile.fullName ?? current.fullName,
      currentRole: extractedProfile.currentRole ?? current.currentRole,
      targetRole: extractedProfile.targetRole ?? current.targetRole,
      yearsExperience:
        extractedProfile.yearsExperience != null
          ? String(extractedProfile.yearsExperience)
          : current.yearsExperience,
      monthsExperience:
        extractedProfile.monthsExperience != null
          ? String(extractedProfile.monthsExperience)
          : current.monthsExperience,
    }));

    setSkills((current) => {
      const merged = [...current];
      for (const skill of extractedProfile.skills) {
        const normalized = skill.trim().toLowerCase();
        if (normalized && !merged.includes(normalized)) {
          merged.push(normalized);
        }
      }
      return merged;
    });
  }, [extractedProfile]);

  const isDirty =
    profileForm.fullName !== "" ||
    profileForm.currentRole !== "" ||
    profileForm.targetRole !== "" ||
    profileForm.yearsExperience !== "0" ||
    profileForm.monthsExperience !== "0" ||
    skills.length > 0 ||
    employmentHistory.length > 0 ||
    salary.amount !== "" ||
    salary.period !== "" ||
    locationPreference !== "";

  function handleBack() {
    if (isDirty && !window.confirm("Leave without saving? Your changes will be lost.")) {
      return;
    }
    router.back();
  }

  function validateEmploymentEntry(entry: EmploymentEntryForm): EmploymentEntryErrors {
    const errors: EmploymentEntryErrors = {};
    if (!entry.employer.trim()) {
      errors.employer = "Enter the employer";
    }
    if (!entry.title.trim()) {
      errors.title = "Enter your title";
    }
    if (!entry.startDate) {
      errors.startDate = "Enter a start date";
    }
    if (entry.endDate && entry.startDate && entry.endDate < entry.startDate) {
      errors.endDate = "End date can't be before the start date";
    }
    return errors;
  }

  async function handleSave() {
    const nextFieldErrors: { fullName?: string; targetRole?: string; skills?: string } = {};
    if (!profileForm.fullName.trim()) {
      nextFieldErrors.fullName = "Enter your name";
    }
    if (!profileForm.targetRole.trim()) {
      nextFieldErrors.targetRole = "Enter the role you're targeting";
    }
    if (skills.length === 0) {
      nextFieldErrors.skills = "Add at least one skill";
    }
    setFieldErrors(nextFieldErrors);

    const nextEmploymentErrors = employmentHistory.map(validateEmploymentEntry);
    setEmploymentErrors(nextEmploymentErrors);
    const employmentValid = nextEmploymentErrors.every((errors) => Object.keys(errors).length === 0);

    const salaryStarted = salary.amount !== "" || salary.period !== "";
    const salaryValid = !salaryStarted || (salary.amount !== "" && salary.period !== "" && salary.currency !== "");
    setSalaryError(
      salaryValid ? null : "Complete all three - amount, currency, and period - or leave salary blank.",
    );

    if (Object.keys(nextFieldErrors).length > 0 || !employmentValid || !salaryValid) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    const body = {
      fullName: profileForm.fullName,
      currentRole: profileForm.currentRole || null,
      targetRole: profileForm.targetRole,
      yearsExperience: Number(profileForm.yearsExperience),
      monthsExperience: Number(profileForm.monthsExperience),
      skills,
      salaryAmount: salary.amount ? Number(salary.amount) : null,
      salaryCurrency: salary.amount ? salary.currency : null,
      salaryPeriod: salary.amount ? salary.period || null : null,
      locationPreference: locationPreference || null,
    };

    const employmentBody = {
      entries: employmentHistory.map((entry) => ({
        employer: entry.employer,
        title: entry.title,
        startDate: entry.startDate,
        endDate: entry.endDate || null,
      })),
    };

    const [profileResponse, employmentResponse] = await Promise.all([
      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify(body),
      }).catch(() => null),
      fetch("/api/profile/employment", {
        method: "PUT",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify(employmentBody),
      }).catch(() => null),
    ]);

    setSaving(false);

    if (!profileResponse?.ok || !employmentResponse?.ok) {
      setSaveError("Something went wrong - try again.");
      return;
    }

    router.push("/app/board");
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-8">
        <BrandMark size="sm" />
        <div className="flex items-center gap-4">
          <SkipLink />
          <StepChip />
        </div>
      </header>
      <main className="px-4 pb-16 pt-12">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[22px] border border-border bg-surface p-11">
          <ResumeDropzone onParsed={setExtractedProfile} />
          <ProfileFields
            values={profileForm}
            onChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
            errors={fieldErrors}
          />
          <EmploymentHistoryFields
            entries={employmentHistory}
            onChange={setEmploymentHistory}
            errors={employmentErrors}
          />
          <SkillsTagInput skills={skills} onChange={setSkills} error={fieldErrors.skills} />
          <SalaryField
            values={salary}
            onChange={(patch) => setSalary((current) => ({ ...current, ...patch }))}
            error={salaryError ?? undefined}
          />
          <LocationSegmented value={locationPreference} onChange={setLocationPreference} />
          <ProfileActions saving={saving} error={saveError} onBack={handleBack} onSave={handleSave} />
        </div>
      </main>
    </div>
  );
}
