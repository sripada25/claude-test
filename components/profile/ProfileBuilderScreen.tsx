"use client";

import { useEffect, useState } from "react";
import { LocationSegmented, type LocationPreference } from "@/components/profile/LocationSegmented";
import { ProfileFields, type ProfileFieldsValues } from "@/components/profile/ProfileFields";
import { ResumeDropzone } from "@/components/profile/ResumeDropzone";
import { SalaryField, type SalaryValues } from "@/components/profile/SalaryField";
import { SkillsTagInput } from "@/components/profile/SkillsTagInput";
import { SkipLink } from "@/components/profile/SkipLink";
import { StepChip } from "@/components/profile/StepChip";
import { BrandMark } from "@/components/ui/BrandMark";
import type { ExtractedProfile } from "@/lib/ai/types";

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
  const [salary, setSalary] = useState<SalaryValues>({ currency: "INR", amount: "", period: "" });
  const [locationPreference, setLocationPreference] = useState<LocationPreference | "">("");

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
          />
          <SkillsTagInput skills={skills} onChange={setSkills} />
          <SalaryField
            values={salary}
            onChange={(patch) => setSalary((current) => ({ ...current, ...patch }))}
          />
          <LocationSegmented value={locationPreference} onChange={setLocationPreference} />
        </div>
      </main>
    </div>
  );
}
