"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";

const MIN_PASSWORD_LENGTH = 12;

export function PasswordField({
  mode,
  value,
  onChange,
  onForgotPassword,
}: {
  mode: "signin" | "signup";
  value: string;
  onChange: (value: string) => void;
  onForgotPassword?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    onChange(next);
    if (error) {
      setError(null);
    }
  }

  function handleBlur() {
    if (mode === "signup" && value.length > 0 && value.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
  }

  return (
    <Field
      id="password"
      name="password"
      label="Password"
      type="password"
      autoComplete={mode === "signup" ? "new-password" : "current-password"}
      required
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      error={error ?? undefined}
      hint={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
      labelAction={
        onForgotPassword && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="font-body text-[12px] font-medium text-accent hover:text-accent-hover hover:underline"
          >
            Forgot password?
          </button>
        )
      }
    />
  );
}
