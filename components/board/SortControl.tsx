"use client";

import { FilterChip } from "@/components/board/FilterChip";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest_activity", label: "Oldest activity" },
  { value: "date_applied", label: "Date applied" },
  { value: "company_az", label: "Company A–Z" },
];

export function SortControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const label = `Sort: ${SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Recent"}`;

  return (
    <FilterChip label={label} active={false}>
      {(close) => (
        <ul role="listbox" aria-label="Sort applications">
          {SORT_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={`flex w-full items-center px-3 py-2 text-left font-body text-[13px] hover:bg-surface-2 ${
                  value === option.value ? "font-semibold text-primary" : "text-ink"
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FilterChip>
  );
}
