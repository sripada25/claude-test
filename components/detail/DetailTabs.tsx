"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";

const TABS = [
  { key: "overview", label: "Overview", count: 0 },
  { key: "documents", label: "Documents", count: 0 },
  { key: "call-log", label: "Call log", count: 0 },
  { key: "reminders", label: "Reminders", count: 0 },
] as const;

const EMPTY_STATES: Record<string, string> = {
  documents: "No documents yet.",
  "call-log": "No calls logged yet.",
  reminders: "No reminders yet.",
};

export function DetailTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") ?? "overview";
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function selectTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
    tabRefs.current[nextIndex]?.focus();
    selectTab(TABS[nextIndex].key);
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        className="flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab, index) => {
          const isActive = tab.key === active;
          const label = tab.count > 0 ? `${tab.label} ${tab.count}` : tab.label;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`shrink-0 border-b-2 px-4 py-[10px] font-body text-[13px] ${
                isActive ? "border-primary font-semibold text-ink" : "border-transparent font-medium text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          tabIndex={0}
          hidden={tab.key !== active}
        >
          {tab.key !== "overview" && (
            <p className="font-body text-[13px] text-muted">{EMPTY_STATES[tab.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
