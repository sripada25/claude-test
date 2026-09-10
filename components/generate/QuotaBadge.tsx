import { Info } from "lucide-react";

export function QuotaBadge({
  tier,
  generationsUsed,
  generationsLimit,
}: {
  tier: "free" | "pro";
  generationsUsed: number;
  generationsLimit: number | null;
}) {
  const isUnlimited = generationsLimit === null;
  const remaining = generationsLimit !== null ? Math.max(generationsLimit - generationsUsed, 0) : 0;

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 bg-accent-soft px-3 py-[7px]">
      <Info size={15} className="text-muted" aria-hidden />
      {isUnlimited ? (
        <span className="font-body text-[12.5px] font-semibold text-accent">Unlimited generations</span>
      ) : (
        <>
          <span className="hidden font-body text-[12.5px] font-semibold text-accent sm:inline">
            {remaining} of {generationsLimit} generations left this month
          </span>
          <span className="font-body text-[12.5px] font-semibold text-accent sm:hidden">
            {remaining} of {generationsLimit} left
          </span>
        </>
      )}
    </div>
  );
}
