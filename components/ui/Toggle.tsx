// M09-3: pen-verified from GPMVt's Notif card - fill: $m-primary + white
// knob when on, fill: $m-surface-2 + white knob when off. No exact pixel
// track/knob size was captured (padding: 2 only), so this uses a standard
// toggle footprint at that same 2px inset.
export function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 p-[2px] transition-colors ${
        checked ? "bg-primary" : "bg-surface-2"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`block size-4 bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}
