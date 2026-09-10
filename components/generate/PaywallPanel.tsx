import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatResetDate(resetDate: string): string {
  const date = new Date(`${resetDate}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

export function PaywallPanel({
  limit,
  resetDate,
  onUpgrade,
}: {
  limit: number;
  resetDate: string;
  onUpgrade: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-stretch justify-between gap-5 border border-accent bg-accent-soft px-5 py-[18px] sm:flex-row sm:items-center"
    >
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center gap-[6px]">
          <Lock size={14} className="text-accent" aria-hidden />
          <span className="font-body text-[13.5px] font-bold text-accent">
            All {limit} generations used — they reset on {formatResetDate(resetDate)}
          </span>
        </div>
        <p className="font-body text-[12.5px] leading-[1.5] text-ink-2">
          Tracking stays unlimited — this only affects new document generation.
        </p>
      </div>
      <Button variant="accent" onClick={onUpgrade} className="max-sm:w-full">
        Upgrade
      </Button>
    </div>
  );
}
