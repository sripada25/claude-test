"use client";

import { useState } from "react";
import { ResumeDropzone } from "@/components/profile/ResumeDropzone";
import { SkipLink } from "@/components/profile/SkipLink";
import { StepChip } from "@/components/profile/StepChip";
import { BrandMark } from "@/components/ui/BrandMark";
import type { ExtractedProfile } from "@/lib/ai/types";

export function ProfileBuilderScreen() {
  const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile | null>(null);

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
        </div>
      </main>
    </div>
  );
}
