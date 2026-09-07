import type { ReactNode } from "react";

type TagVariant = "primary-soft";

const VARIANT_CLASSES: Record<TagVariant, string> = {
  "primary-soft": "bg-primary-soft text-primary",
};

export function Tag({
  variant,
  children,
  className = "",
}: {
  variant: TagVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-[8px] py-[4px] font-mono text-[10.5px] font-semibold tracking-[0.5px] ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
