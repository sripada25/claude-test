"use client";

import { useEffect, useState } from "react";
import { DetailTopBar } from "@/components/detail/DetailTopBar";
import { Sidebar } from "@/components/shell/Sidebar";

interface ApplicationDetail {
  id: string;
  status: string;
}

export function DetailScreen({ id }: { id: string }) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (!data) {
          setNotFound(true);
          return;
        }
        setApplication(data);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={false} onClose={() => {}} />
      <main className="flex flex-1 flex-col overflow-hidden">
        {notFound ? (
          <p className="p-7 font-body text-[13px] text-muted">Application not found.</p>
        ) : (
          application && (
            <DetailTopBar
              applicationId={application.id}
              status={application.status}
              onStatusChange={(status) =>
                setApplication((current) => (current ? { ...current, status } : current))
              }
            />
          )
        )}
      </main>
    </div>
  );
}
