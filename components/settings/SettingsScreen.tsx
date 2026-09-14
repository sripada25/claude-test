"use client";

import Link from "next/link";
import { Sidebar } from "@/components/shell/Sidebar";
import { AccountSection } from "@/components/settings/AccountSection";
import { PlanSection } from "@/components/settings/PlanSection";
import { DataPrivacySection } from "@/components/settings/DataPrivacySection";

const NAV_ITEMS = [
  { label: "Account", href: "#account", active: true },
  { label: "Profile", href: "/app/profile", active: false },
  { label: "Plan & billing", href: "#plan", active: false },
  { label: "Data & privacy", href: "#data", active: false },
];

// M09-1: pen-verified nav lists a "Profile" item alongside Account/Plan/Data,
// but the mockup's own content column has no separate Profile section - it
// links out to the existing /app/profile page instead of duplicating it
// here. The other three are in-page anchors, not switched tabs - the
// mockup's content shows all sections stacked at once, not one at a time.
export function SettingsScreen() {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={false} onClose={() => {}} />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-8">
          <span className="font-display text-[16px] font-semibold text-ink">Settings</span>
        </div>
        <div className="flex flex-1 gap-8 px-7 py-[26px]">
          <nav className="flex w-[180px] shrink-0 flex-col gap-[2px]">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-[9px] font-body text-[13px] font-medium ${
                  item.active
                    ? "border border-primary bg-primary-soft text-primary"
                    : "border border-transparent text-ink-2 hover:bg-surface-2"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex max-w-[640px] flex-1 flex-col gap-7">
            <AccountSection />
            <PlanSection />
            <DataPrivacySection />
          </div>
        </div>
      </main>
    </div>
  );
}
