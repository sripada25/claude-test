import Link from "next/link";

export function TermsNotice() {
  return (
    <p className="mt-[22px] w-full text-center font-body text-[11.5px] leading-[1.5] text-muted">
      By continuing you agree to the{" "}
      <Link
        href="/terms"
        className="text-muted underline decoration-border-strong underline-offset-2 hover:text-ink-2"
      >
        Terms
      </Link>{" "}
      and{" "}
      <Link
        href="/privacy"
        className="text-muted underline decoration-border-strong underline-offset-2 hover:text-ink-2"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
