import { Loader2 } from "lucide-react";

export function SignInButton({
  loading,
  canSubmit,
  label,
}: {
  loading: boolean;
  canSubmit: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || !canSubmit}
      aria-busy={loading}
      className="inline-flex w-full items-center justify-center gap-2 bg-primary px-[22px] py-[13px] font-body text-[13.5px] font-semibold tracking-[0.1px] text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted motion-reduce:transition-none"
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : label}
    </button>
  );
}
