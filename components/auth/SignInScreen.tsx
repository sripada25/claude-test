"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { EmailField } from "@/components/auth/EmailField";
import { PasswordField } from "@/components/auth/PasswordField";

type AuthMode = "signin" | "signup" | "forgot";

export function SignInScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submitLabel = mode === "signin" ? "Sign in" : "Create account";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

        <AuthHeading mode={mode} />

        <form className="mt-[26px] flex w-full flex-col gap-4" onSubmit={onSubmit}>
          <EmailField value={email} onChange={setEmail} />
          <PasswordField
            mode={mode === "signup" ? "signup" : "signin"}
            value={password}
            onChange={setPassword}
            onForgotPassword={() => setMode("forgot")}
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 bg-primary px-[22px] py-[13px] font-body text-[13.5px] font-semibold tracking-[0.1px] text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none motion-reduce:transition-none"
          >
            {submitLabel}
          </button>
        </form>

        <div
          className="mt-[22px] flex w-full items-center gap-3"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[11px] text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-[22px] flex w-full flex-col gap-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-[10px] border border-border-strong bg-surface px-4 py-[11px] font-body text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none"
          >
            <span
              className="grid size-[18px] place-items-center bg-[#1A73E8] font-display text-[10.5px] font-bold text-white"
              aria-hidden
            >
              G
            </span>
            Continue with Google
          </button>
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
