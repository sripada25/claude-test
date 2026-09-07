"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

const ALLOW_PROFILE_SKIP = false;

export function SkipLink() {
  const router = useRouter();

  if (!ALLOW_PROFILE_SKIP) {
    return null;
  }

  function handleSkip() {
    router.push("/app/board");
  }

  return (
    <button
      onClick={handleSkip}
      aria-label="Skip for now"
      className="flex size-[44px] items-center justify-center gap-1.5 font-body text-[13px] font-medium text-ink-2 hover:text-ink sm:size-auto sm:justify-start"
    >
      <span className="hidden sm:inline">Skip for now</span>
      <ArrowRight size={14} />
    </button>
  );
}
