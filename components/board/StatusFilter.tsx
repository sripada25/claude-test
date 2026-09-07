"use client";

import { FilterChip } from "@/components/board/FilterChip";
import { STAGES } from "@/components/board/stages";

const STATUS_OPTIONS = STAGES.map(({ value, label }) => ({ value, label }));

export function StatusFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const label =
    selected.length === 0
      ? "Status"
      : `Status: ${selected
          .map((value) => STATUS_OPTIONS.find((option) => option.value === value)?.label)
          .join(", ")}`;

  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <FilterChip label={label} active={selected.length > 0}>
      {() => (
        <ul role="listbox" aria-multiselectable="true" aria-label="Filter by status">
          {STATUS_OPTIONS.map((option) => (
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
      )}
    </FilterChip>
  );
}
