import type { ReactNode } from "react";

type FieldProps = {
  id: string;
  label: string;
  type?: "email" | "password" | "text" | "date" | "url";
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  labelAction?: ReactNode;
  error?: string;
  hint?: string;
};

export function Field({
  id,
  label,
  type = "text",
  name,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  required,
  labelAction,
  error,
  hint,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex w-full flex-col gap-[7px]">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label
          htmlFor={id}
          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
        >
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="w-full border border-border bg-surface px-[13px] py-[11px] font-body text-[13.5px] text-ink placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary focus-visible:outline-none aria-[invalid=true]:border-danger"
      />
      {error ? (
        <p id={errorId} className="font-body text-[12px] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="font-body text-[12px] text-muted">{hint}</p>
      )}
    </div>
  );
}
