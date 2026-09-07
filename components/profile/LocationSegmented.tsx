"use client";

import { useRef, type KeyboardEvent } from "react";

export type LocationPreference = "remote" | "hybrid" | "onsite";

const OPTIONS: { value: LocationPreference; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

export function LocationSegmented({
  value,
  onChange,
}: {
  value: LocationPreference | "";
  onChange: (value: LocationPreference) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = OPTIONS.findIndex((option) => option.value === value);
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function focusAndSelect(index: number) {
    const wrapped = (index + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[wrapped].value);
    buttonRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusAndSelect(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAndSelect(index - 1);
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <span
        id="location-preference-label"
        className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
      >
        Location preference
      </span>
      <div role="radiogroup" aria-labelledby="location-preference-label" className="flex flex-wrap gap-2">
        {OPTIONS.map((option, index) => (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            tabIndex={index === tabbableIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`h-[38px] border px-[14px] py-2 font-body text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              value === option.value
                ? "border-primary bg-primary text-white"
                : "border-border-strong bg-surface text-ink-2"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
