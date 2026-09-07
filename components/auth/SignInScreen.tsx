"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { EmailField } from "@/components/auth/EmailField";
import { GoogleSSOButton } from "@/components/auth/GoogleSSOButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordField } from "@/components/auth/PasswordField";
import { SignInButton } from "@/components/auth/SignInButton";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

type AuthMode = "signin" | "signup" | "forgot" | "otp";

export function SignInScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitLabel = mode === "signin" ? "Sign in" : "Create account";
  const canSubmit = email.trim() !== "" && password.trim() !== "";

  // Shared by a successful login and a successful OTP verification - both
  // end with a fresh session cookie and the same "where does this user go"
  // question, which needs a second call since neither response carries
  // profile.completedAt.
  async function goToProfileOrBoard() {
    const profileResponse = await fetch("/api/profile");
    const profile = profileResponse.ok ? await profileResponse.json() : null;
    router.push(profile?.completedAt ? "/app/board" : "/app/profile");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Only signin submits for real - no M01 task wires up signup's
    // POST /api/auth/signup yet.
    if (mode !== "signin" || loading || !canSubmit) {
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setFormError(
          response.status === 429
            ? "Too many attempts. Try again in a few minutes."
            : "Incorrect email or password.",
        );
        return;
      }

      await goToProfileOrBoard();
    } catch {
      setFormError("That didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-pen-id="Ziq0l"
      className="flex min-h-screen items-center justify-center bg-bg px-5 py-10"
    >
      <AuthCard>
        <div className="flex items-center gap-[9px]" aria-hidden="true">
          <span className="grid size-[26px] place-items-center bg-accent font-display text-[13px] font-bold text-white">
            T
          </span>
          <span className="font-display text-[16px] font-bold tracking-[0.2px] text-ink">
            TRACKR
          </span>
        </div>

        <AuthHeading mode={mode} email={email} />

        <form className="mt-[26px] flex w-full flex-col gap-4" onSubmit={onSubmit}>
          <EmailField value={email} onChange={setEmail} />
          <PasswordField
            mode={mode === "signup" ? "signup" : "signin"}
            value={password}
            onChange={setPassword}
            onForgotPassword={() => setMode("forgot")}
          />
          {mode === "otp" && (
            <OtpInput email={email} onVerified={() => void goToProfileOrBoard()} />
          )}
          {formError && (
            <p role="alert" className="font-body text-[12px] text-danger">
              {formError}
            </p>
          )}
          <SignInButton loading={loading} canSubmit={canSubmit} label={submitLabel} />
        </form>

        <OrDivider />

        <div className="mt-[22px] flex w-full flex-col gap-3">
          <GoogleSSOButton />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-[10px] border border-border-strong bg-surface px-4 py-[11px] font-body text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none"
          >
            <span
              className="grid size-[18px] place-items-center bg-[#0A66C2] font-display text-[10.5px] font-bold text-white"
              aria-hidden
            >
              in
            </span>
            Continue with LinkedIn
          </button>
        </div>

        <div className="mt-[26px] h-px w-full bg-border" />

        <p className="mt-[18px] flex justify-center gap-[5px] text-center font-body text-[13px] text-ink-2">
          {mode === "signin" ? (
            <>
              New here?
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Sign in
              </button>
            </>
          )}
        </p>

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
      </AuthCard>
    </div>
  );
}
