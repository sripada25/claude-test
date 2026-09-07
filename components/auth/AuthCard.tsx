import type { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="w-full max-w-[420px] border border-border bg-surface px-5 py-6 sm:px-10 sm:py-11">
      {children}
    </main>
  );
}
