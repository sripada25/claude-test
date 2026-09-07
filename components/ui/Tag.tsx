import { X } from "lucide-react";
import type { ReactNode } from "react";

type TagVariant = "primary-soft" | "skill";

const VARIANT_CLASSES: Record<TagVariant, string> = {
  "primary-soft": "px-[8px] py-[4px] bg-primary-soft text-primary",
  skill: "gap-[6px] px-[10px] py-[5px] bg-surface-2 text-ink-2",
};

export function Tag({
  variant,
  children,
  className = "",
  removable,
}: {
  variant: TagVariant;
  children: ReactNode;
  className?: string;
  removable?: { label: string; onRemove: () => void };
}) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10.5px] font-semibold tracking-[0.5px] ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
      {removable && (
        <button
          type="button"
          aria-label={`Remove ${removable.label}`}
          onClick={removable.onRemove}
          className="text-muted transition-colors duration-150 hover:text-danger"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
