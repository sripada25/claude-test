"use client";

import { useEffect, useState } from "react";
import { BoardTopBar } from "@/components/board/BoardTopBar";
import { Sidebar } from "@/components/shell/Sidebar";

export function BoardScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<unknown[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const search = query ? `?q=${encodeURIComponent(query)}` : "";
      const response = await fetch(`/api/applications${search}`).catch(() => null);
      if (!response?.ok) {
        return;
      }
      const data = await response.json();
      if (!cancelled) {
        setApplications(data);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <BoardTopBar onOpenDrawer={() => setDrawerOpen(true)} onQueryChange={setQuery} />
        <p role="status" aria-live="polite" className="sr-only">
          {applications.length} results
        </p>
        <div className="flex-1 overflow-x-auto px-7 py-[26px]">
          <div className="flex gap-4" />
        </div>
      </main>
    </div>
  );
}
