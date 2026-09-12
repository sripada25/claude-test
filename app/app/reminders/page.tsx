import { Suspense } from "react";
import { RemindersScreen } from "@/components/reminders/RemindersScreen";

export default function RemindersPage() {
  return (
    <Suspense fallback={null}>
      <RemindersScreen />
    </Suspense>
  );
}
