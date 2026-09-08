"use client";

import { useEffect, useState } from "react";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailTopBar } from "@/components/detail/DetailTopBar";
import { Sidebar } from "@/components/shell/Sidebar";

export interface ApplicationDetail {
  id: string;
  company: string;
  role: string;
  status: string;
  dateApplied: string | null;
  source: string | null;
  sourceUrl: string | null;
  jobDescription: string | null;
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
            <>
              <DetailTopBar
                application={application}
                onStatusChange={(status) =>
                  setApplication((current) => (current ? { ...current, status } : current))
                }
              />
              <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-7 py-[26px]">
                <DetailHeader
                  company={application.company}
                  role={application.role}
                  dateApplied={application.dateApplied}
                  source={application.source}
                  sourceUrl={application.sourceUrl}
                />
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
