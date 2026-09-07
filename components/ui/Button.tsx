import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type ButtonSize = "base" | "sm";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  base: "px-[22px] py-[13px] text-[13.5px]",
  sm: "px-[18px] py-[10px] text-[12.5px]",
};

export function Button({
  size = "base",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 bg-primary font-body font-semibold tracking-[0.1px] text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted motion-reduce:transition-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : children}
    </button>
  );
}
