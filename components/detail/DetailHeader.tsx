import { ExternalLink } from "lucide-react";
import { SOURCE_OPTIONS } from "@/components/board/ApplicationFields";
import { isAllowedUrlScheme } from "@/lib/security/url-scheme";

const CHIP_CLASSES = "flex items-center gap-[5px] bg-surface-2 px-[10px] py-[5px] font-mono text-[10.5px] font-semibold text-ink-2";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatAppliedDate(dateApplied: string): string {
  const date = new Date(dateApplied);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

export function DetailHeader({
  company,
  role,
  dateApplied,
  source,
  sourceUrl,
}: {
  company: string;
  role: string;
  dateApplied: string | null;
  source: string | null;
  sourceUrl: string | null;
}) {
  const sourceLabel = SOURCE_OPTIONS.find((option) => option.value === source)?.label;
  const showPosting = sourceUrl && isAllowedUrlScheme(sourceUrl);

  return (
    <div className="flex flex-col gap-[10px]">
      <h1 className="font-display text-[18px] font-semibold tracking-[-0.3px] text-ink sm:text-[22px]">
        <span>{company}</span> <span>—</span> <span>{role}</span>
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {dateApplied && (
          <span className={CHIP_CLASSES}>Applied {formatAppliedDate(dateApplied)}</span>
        )}
        {sourceLabel && <span className={CHIP_CLASSES}>Source: {sourceLabel}</span>}
        {showPosting && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={CHIP_CLASSES}
          >
            View posting
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
