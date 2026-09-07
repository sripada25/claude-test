"use client";

import { FilterChip } from "@/components/board/FilterChip";

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "naukri", label: "Naukri" },
  { value: "indeed", label: "Indeed" },
  { value: "referral", label: "Referral" },
  { value: "company_site", label: "Company site" },
  { value: "other", label: "Other" },
];

export function SourceFilter({
  selected,
  onChange,
  hasAnySource,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
  hasAnySource: boolean;
}) {
  const label =
    selected.length === 0
      ? "Source"
      : `Source: ${selected
          .map((value) => SOURCE_OPTIONS.find((option) => option.value === value)?.label)
          .join(", ")}`;

  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <FilterChip label={label} active={selected.length > 0}>
      {() =>
        hasAnySource ? (
          <ul role="listbox" aria-multiselectable="true" aria-label="Filter by source">
            {SOURCE_OPTIONS.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected.includes(option.value)}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[13px] text-ink hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    readOnly
                    className="pointer-events-none"
                  />
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 font-body text-[12.5px] text-muted">
            Add a source when creating an application to filter by it here.
          </p>
        )
      }
    </FilterChip>
  );
}
