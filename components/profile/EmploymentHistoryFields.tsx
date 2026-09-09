"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export type EmploymentEntryForm = {
  employer: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type EmploymentEntryErrors = {
  employer?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
};

const EMPTY_ENTRY: EmploymentEntryForm = { employer: "", title: "", startDate: "", endDate: "" };

export function EmploymentHistoryFields({
  entries,
  onChange,
  errors,
}: {
  entries: EmploymentEntryForm[];
  onChange: (entries: EmploymentEntryForm[]) => void;
  errors?: EmploymentEntryErrors[];
}) {
  function updateEntry(index: number, patch: Partial<EmploymentEntryForm>) {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  function addEntry() {
    onChange([...entries, EMPTY_ENTRY]);
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <label className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
        Employment history
      </label>
      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <div key={index} className="flex flex-col gap-3 border border-border bg-surface p-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  aria-label={`Remove ${entry.employer || "employment"} entry`}
                  onClick={() => removeEntry(index)}
                  className="text-muted transition-colors duration-150 hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  id={`employment-${index}-employer`}
                  label="Employer"
                  name={`employer-${index}`}
                  value={entry.employer}
                  onChange={(value) => updateEntry(index, { employer: value })}
                  error={errors?.[index]?.employer}
                />
                <Field
                  id={`employment-${index}-title`}
                  label="Title"
                  name={`title-${index}`}
                  value={entry.title}
                  onChange={(value) => updateEntry(index, { title: value })}
                  error={errors?.[index]?.title}
                />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  id={`employment-${index}-start`}
                  label="Start date"
                  type="date"
                  name={`start-${index}`}
                  value={entry.startDate}
                  onChange={(value) => updateEntry(index, { startDate: value })}
                  error={errors?.[index]?.startDate}
                />
                <Field
                  id={`employment-${index}-end`}
                  label="End date"
                  type="date"
                  name={`end-${index}`}
                  value={entry.endDate}
                  onChange={(value) => updateEntry(index, { endDate: value })}
                  error={errors?.[index]?.endDate}
                  hint="Leave blank if this is your current role"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={addEntry} className="self-start">
        <Plus size={14} />
        Add employment
      </Button>
    </div>
  );
}
