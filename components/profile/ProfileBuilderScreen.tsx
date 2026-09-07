"use client";

import { useEffect, useState } from "react";
import { ProfileFields, type ProfileFieldsValues } from "@/components/profile/ProfileFields";
import { ResumeDropzone } from "@/components/profile/ResumeDropzone";
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
        </div>
      </main>
    </div>
  );
}
