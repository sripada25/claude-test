"use client";

import { useEffect, useState } from "react";

// Count = dueNow only, not dueNow + upcoming - the spec's own aria-label
// example text is "reminders due," not a total.
export function RemindersBadge() {
  const [dueNowCount, setDueNowCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/reminders")
      .then((response) => (response.ok ? response.json() : { dueNow: [] }))
      .then((data: { dueNow: unknown[] }) => {
        if (!cancelled) {
          setDueNowCount(data.dueNow.length);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (dueNowCount === 0) {
    return null;
  }

  return (
    <span
      aria-label={dueNowCount === 1 ? "1 reminder due" : `${dueNowCount} reminders due`}
      className="ml-auto bg-accent px-[5px] py-[2px] font-mono text-[9.5px] font-semibold text-accent-foreground"
    >
      {dueNowCount}
    </span>
  );
}
