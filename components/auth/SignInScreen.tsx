"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { CreateAccountLink } from "@/components/auth/CreateAccountLink";
import { EmailField } from "@/components/auth/EmailField";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { GoogleSSOButton } from "@/components/auth/GoogleSSOButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordField } from "@/components/auth/PasswordField";
import { SignInButton } from "@/components/auth/SignInButton";
import { TermsNotice } from "@/components/auth/TermsNotice";
import { BrandMark } from "@/components/ui/BrandMark";
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

  function mapSignupError(reason: string): string {
    switch (reason) {
      case "weak_password":
        return "Use at least 12 characters.";
      case "invalid_email":
        return "Enter a valid email address.";
      case "rate_limited":
        return "Too many attempts. Try again in a few minutes.";
      default:
        return "That didn't work. Try again.";
    }
  }

  async function submitLogin() {
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
  }

  async function submitSignup() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
      body: JSON.stringify({ email, password, timezone }),
    });
    const result = await response.json();

    // Anti-enumeration by design (T3.1): a duplicate email gets the exact
    // same {success:true} - it silently gets a notice email instead of an
    // OTP. The frontend can't and shouldn't try to tell the two apart.
    if (!result.success) {
      setFormError(mapSignupError(result.reason));
      return;
    }

    setMode("otp");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ((mode !== "signin" && mode !== "signup") || loading || !canSubmit) {
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      if (mode === "signin") {
        await submitLogin();
      } else {
        await submitSignup();
      }
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
        <BrandMark size="md" />

        <AuthHeading mode={mode} email={email} />

        {mode === "forgot" ? (
          <>
            <ForgotPasswordForm onSuccess={() => void goToProfileOrBoard()} />
            <p className="mt-[18px] flex justify-center gap-[5px] text-center font-body text-[13px] text-ink-2">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
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

            <CreateAccountLink
              mode={mode === "signin" ? "signin" : "signup"}
              onSwitch={setMode}
            />
          </>
        )}

        <TermsNotice />
      </AuthCard>
    </div>
  );
}
