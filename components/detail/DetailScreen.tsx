"use client";

import { DetailTopBar } from "@/components/detail/DetailTopBar";
import { Sidebar } from "@/components/shell/Sidebar";

export function DetailScreen({ id: _id }: { id: string }) {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={false} onClose={() => {}} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <DetailTopBar />
      </main>
    </div>
  );
}
