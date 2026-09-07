"use client";

import { useRef, type KeyboardEvent } from "react";

export type BoardView = "board" | "list";

const COOKIE_NAME = "board_view";

const OPTIONS: { value: BoardView; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
];

export function ViewToggle({
  value,
  onChange,
}: {
  value: BoardView;
  onChange: (value: BoardView) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = OPTIONS.findIndex((option) => option.value === value);

  function select(next: BoardView) {
    onChange(next);
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function focusAndSelect(index: number) {
    const wrapped = (index + OPTIONS.length) % OPTIONS.length;
    select(OPTIONS[wrapped].value);
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
    <div role="radiogroup" aria-label="View" className="flex shrink-0 gap-[2px] border border-border bg-bg p-[3px]">
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
          onClick={() => select(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`flex h-11 items-center justify-center border px-4 font-body text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:h-auto md:px-[16px] md:py-[7px] ${
            value === option.value
              ? "border-border bg-surface font-semibold text-ink"
              : "border-transparent font-medium text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
