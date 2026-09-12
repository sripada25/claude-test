export interface CardTagData {
  key: string;
  label: string;
  ariaLabel?: string;
  variant: "default" | "follow-up";
  href?: string;
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });

function shortWeekday(date: Date): string {
  return WEEKDAY.format(date);
}

function compactTime(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes === 0 ? `${hours12}${period}` : `${hours12}:${String(minutes).padStart(2, "0")}${period}`;
}

function ageTag(lastActivityAt: string): CardTagData {
  const days = Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24));
  const ariaLabel =
    days === 0 ? "Last activity today" : days === 1 ? "Last activity 1 day ago" : `Last activity ${days} days ago`;
  return { key: "age", label: `${days}d`, ariaLabel, variant: "default" };
}

export function deriveCardTags(application: {
  id: string;
  lastActivityAt: string;
  followUpDue: boolean;
  assessmentDueAt: string | null;
  interviewAt: string | null;
}): { visible: CardTagData[]; overflowCount: number } {
  const candidates: CardTagData[] = [];

  if (application.followUpDue) {
    candidates.push({
      key: "follow-up",
      label: "Follow up",
      variant: "follow-up",
      href: `/app/reminders?applicationId=${application.id}`,
    });
  }

  if (application.interviewAt) {
    const date = new Date(application.interviewAt);
    candidates.push({
      key: "interview-time",
      label: `${shortWeekday(date)} ${compactTime(date)}`,
      variant: "default",
    });
  } else if (application.assessmentDueAt) {
    const date = new Date(application.assessmentDueAt);
    candidates.push({ key: "assessment-due", label: `Due ${shortWeekday(date)}`, variant: "default" });
  }

  candidates.push(ageTag(application.lastActivityAt));

  return { visible: candidates.slice(0, 2), overflowCount: Math.max(0, candidates.length - 2) };
}
