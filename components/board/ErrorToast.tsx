"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-[380px] items-start gap-[11px] border-l-[3px] border-danger bg-surface p-[14px] shadow-lg sm:inset-x-auto sm:right-4 sm:mx-0"
    >
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
      <span className="font-body text-[13px] text-ink">{message}</span>
    </div>
  );
}
