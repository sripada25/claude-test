"use client";

import { useRef, type KeyboardEvent } from "react";

export type DocumentType = "cover_letter" | "resume";

const OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "cover_letter", label: "Cover letter" },
  { value: "resume", label: "Resume" },
];

export function DocumentTypeToggle({
  value,
  onChange,
}: {
  value: DocumentType;
  onChange: (value: DocumentType) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = OPTIONS.findIndex((option) => option.value === value);

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
    <div role="radiogroup" aria-label="Document type" className="flex flex-col gap-[9px] lg:flex-row">
      {OPTIONS.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={index === selectedIndex ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`border px-4 py-3 text-center font-body text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
            value === option.value
              ? "border-primary bg-primary text-white"
              : "border-border-strong bg-surface text-ink-2"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
