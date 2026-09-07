"use client";

import { useEffect, useRef } from "react";

export type AuthHeadingMode = "signin" | "signup" | "forgot" | "otp";

const SUBTITLE_TRACK =
  "Track applications, generate documents, never miss a follow-up.";

function contentFor(mode: AuthHeadingMode, email?: string): { heading: string; subtitle: string } {
  switch (mode) {
    case "signin":
      return { heading: "Sign in to your account", subtitle: SUBTITLE_TRACK };
    case "signup":
      return { heading: "Create your account", subtitle: SUBTITLE_TRACK };
    case "forgot":
      return {
        heading: "Reset your password",
        subtitle: "Enter your email and we'll send you a code.",
      };
    case "otp":
      return {
        heading: "Check your email",
        subtitle: `We sent a 6-digit code to ${email ?? ""}.`,
      };
  }
}

export function AuthHeading({ mode, email }: { mode: AuthHeadingMode; email?: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { heading, subtitle } = contentFor(mode, email);

  useEffect(() => {
    headingRef.current?.focus();
  }, [mode]);

  return (
    <>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-[28px] font-display text-[20px] font-semibold tracking-[-0.3px] text-ink outline-none sm:text-[23px]"
      >
        {heading}
      </h1>
      <p className="mt-[6px] w-full font-body text-[14px] leading-[1.5] text-ink-2 sm:w-[340px]">
        {subtitle}
      </p>
    </>
  );
}
