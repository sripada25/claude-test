"use client";

import { useContext } from "react";
import { DrawerCloseContext } from "@/components/board/Drawer";
import { Button } from "@/components/ui/Button";

export function DrawerActions({ saving, canSave }: { saving: boolean; canSave: boolean }) {
  const requestClose = useContext(DrawerCloseContext);

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border px-7 pb-6 pt-5 md:flex-row md:justify-end">
      <button
        type="button"
        onClick={requestClose}
        disabled={saving}
        className="w-full border border-border-strong bg-surface px-5 py-[13px] font-body text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
      >
        Cancel
      </button>
      <Button type="submit" loading={saving} disabled={!canSave} className="w-full md:w-auto">
        Save application
      </Button>
    </div>
  );
}
