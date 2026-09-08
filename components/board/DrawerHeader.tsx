"use client";

import { X } from "lucide-react";
import { useContext } from "react";
import { DrawerCloseContext } from "@/components/board/Drawer";

export function DrawerHeader({ title }: { title: string }) {
  const requestClose = useContext(DrawerCloseContext);

  return (
    <div className="flex items-center justify-between border-b border-border pb-[14px] pl-5 pr-5 pt-4 md:pb-5 md:pl-7 md:pr-7 md:pt-6">
      <h2 id="drawer-title" className="font-display text-[19px] font-semibold tracking-[-0.2px] text-ink">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="flex size-11 items-center justify-center"
      >
        <X size={18} className="text-muted" />
      </button>
    </div>
  );
}
