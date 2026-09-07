"use client";

import { useState } from "react";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { Sidebar } from "@/components/shell/Sidebar";

export function BoardScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <BoardTopBar onOpenDrawer={() => setDrawerOpen(true)} />
        <div className="flex-1 overflow-x-auto px-7 py-[26px]">
          <div className="flex gap-4" />
        </div>
      </main>
    </div>
  );
}
