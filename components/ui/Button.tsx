import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonSize = "base" | "sm" | "md";
type ButtonVariant = "primary" | "secondary";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  base: "px-[22px] py-[13px] text-[13.5px]",
  sm: "px-[18px] py-[10px] text-[12.5px]",
  md: "px-4 py-[11px] text-[13.5px]",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted",
  secondary:
    "border border-border-strong bg-surface text-ink hover:border-ink-2 disabled:border-border disabled:text-muted",
};

export function Button({
  size = "base",
  variant = "primary",
  icon,
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 font-body font-semibold tracking-[0.1px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed motion-reduce:transition-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
