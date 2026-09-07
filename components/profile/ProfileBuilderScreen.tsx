import { StepChip } from "@/components/profile/StepChip";

export function ProfileBuilderScreen() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-8">
        <div className="flex items-center gap-[9px]" aria-hidden="true">
          <span className="grid size-[26px] place-items-center bg-accent font-display text-[13px] font-bold text-white">
            T
          </span>
          <span className="font-display text-[16px] font-bold tracking-[0.2px] text-ink">
            TRACKR
          </span>
        </div>
        <StepChip />
      </header>
      <main className="px-4 pb-16 pt-12">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[22px] border border-border bg-surface p-11" />
      </main>
    </div>
  );
}
