import { FileText } from "lucide-react";
import type { DocumentType } from "@/components/generate/DocumentTypeToggle";

export interface DocumentSummary {
  id: string;
  type: DocumentType;
  createdAt: string;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatDate(createdAt: string): string {
  const date = new Date(createdAt);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  cover_letter: "Cover letter",
  resume: "Resume",
};

export function DocumentsPanel({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return (
      <p className="font-body text-[13px] text-muted">
        No documents yet. Generate one from the actions panel.
      </p>
    );
  }

  return (
    <ol className="flex flex-col border border-border bg-surface">
      {documents.map((document, index) => (
        <li
          key={document.id}
          className={`flex items-center gap-3 p-[13px_16px] max-sm:flex-wrap ${index > 0 ? "border-t border-border" : ""}`}
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
            <FileText size={14} className="text-primary" />
          </span>
          <span className="flex-1 font-body text-[13px] text-ink">{TYPE_LABEL[document.type]}</span>
          <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">
            {formatDate(document.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
