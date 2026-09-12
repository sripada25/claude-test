"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { ReminderQueue, type ReminderQueueData, type ReminderQueueItem } from "@/components/reminders/ReminderQueue";
import { DraftPane } from "@/components/reminders/DraftPane";
import { NewReminderAction } from "@/components/reminders/NewReminderAction";

function findItem(queue: ReminderQueueData, id: string): ReminderQueueItem | undefined {
  return queue.dueNow.find((item) => item.id === id) ?? queue.upcoming.find((item) => item.id === id) ?? queue.done.find((item) => item.id === id);
}

export function RemindersScreen() {
  const searchParams = useSearchParams();
  const highlightApplicationId = searchParams.get("applicationId");
  const [queue, setQueue] = useState<ReminderQueueData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/reminders")
      .then((response) => (response.ok ? response.json() : { dueNow: [], upcoming: [], done: [] }))
      .then((data: ReminderQueueData) => {
        if (cancelled) {
          return;
        }
        setQueue(data);
        if (highlightApplicationId) {
          const match =
            data.dueNow.find((item) => item.applicationId === highlightApplicationId) ??
            data.upcoming.find((item) => item.applicationId === highlightApplicationId) ??
            data.done.find((item) => item.applicationId === highlightApplicationId);
          if (match) {
            setSelectedId((current) => current ?? match.id);
          }
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const refresh = useCallback(() => setRefreshSignal((current) => current + 1), []);

  function handleResolved() {
    setSelectedId(null);
    refresh();
  }

  const selectedItem = queue && selectedId ? findItem(queue, selectedId) : undefined;

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={false} onClose={() => {}} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-border bg-surface px-8">
          <div className="flex items-center gap-2">
            <span className="border border-border-strong bg-surface px-[10px] py-[5px] font-mono text-[11px] font-semibold text-ink-2">
              Due {queue?.dueNow.length ?? 0}
            </span>
            <span className="border border-border-strong bg-surface px-[10px] py-[5px] font-mono text-[11px] font-semibold text-ink-2">
              Upcoming {queue?.upcoming.length ?? 0}
            </span>
            <span className="border border-border-strong bg-surface px-[10px] py-[5px] font-mono text-[11px] font-semibold text-ink-2">
              Done
            </span>
          </div>
          <NewReminderAction onCreated={refresh} />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[320px] shrink-0 overflow-y-auto border-r border-border p-6">
            {queue && <ReminderQueue queue={queue} selectedId={selectedId} onSelect={setSelectedId} />}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {selectedItem ? (
              <DraftPane
                key={selectedItem.id}
                reminderId={selectedItem.id}
                applicationId={selectedItem.applicationId}
                onResolved={handleResolved}
              />
            ) : (
              <p className="font-body text-[13px] text-muted">Select a reminder to see its draft.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
