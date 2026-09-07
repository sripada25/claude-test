"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";

function validateEmail(value: string): string | null {
  if (value.trim() === "") {
    return "Enter your email.";
  }
  if (!value.includes("@")) {
    return "Enter a valid email address.";
  }
  return null;
}

export function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    onChange(next);
    if (error) {
      setError(null);
    }
  }

  function handleBlur() {
    setError(validateEmail(value));
  }

  return (
    <Field
      id="email"
      name="email"
      label="Email"
      type="email"
      autoComplete="email"
      required
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="you@example.com"
      error={error ?? undefined}
    />
  );
}
