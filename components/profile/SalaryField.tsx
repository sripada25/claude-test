"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type SalaryValues = {
  currency: string;
  amount: string;
  period: "monthly" | "annual" | "";
};

const PERIODS: { value: "monthly" | "annual"; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

function formatAmount(raw: string): string {
  if (!raw) {
    return "";
  }
  return new Intl.NumberFormat("en-IN").format(Number(raw));
}

export function SalaryField({
  values,
  onChange,
  error,
}: {
  values: SalaryValues;
  onChange: (patch: Partial<SalaryValues>) => void;
  error?: string;
}) {
  const [amountFocused, setAmountFocused] = useState(false);
  const displayAmount = amountFocused ? values.amount : formatAmount(values.amount);

  return (
    <fieldset className="m-0 flex flex-col gap-[7px] border-0 p-0">
      <legend className="p-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
        Salary expectation
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[74px] shrink-0">
          <select
            aria-label="Salary currency"
            value={values.currency}
            onChange={(event) => onChange({ currency: event.target.value })}
            className="w-full appearance-none border border-border bg-surface-2 px-[10px] py-[11px] font-body text-[13px] font-semibold text-ink"
          >
            <option value="INR">INR</option>
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Salary amount"
          value={displayAmount}
          onFocus={() => setAmountFocused(true)}
          onBlur={() => setAmountFocused(false)}
          onChange={(event) => onChange({ amount: event.target.value.replace(/\D/g, "") })}
          className="min-w-[140px] flex-1 border border-border bg-surface px-[13px] py-[11px] font-body text-[13.5px] text-ink"
        />
        <div role="radiogroup" aria-label="Salary period" className="flex shrink-0 gap-2">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={values.period === value}
              onClick={() => onChange({ period: value })}
              className={`border px-[14px] py-2 font-body text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                values.period === value
                  ? "border-primary bg-primary text-white"
                  : "border-border-strong bg-surface text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="font-body text-[12px] text-danger">{error}</p>}
    </fieldset>
  );
}
