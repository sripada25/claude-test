// Static map, never interpolated - Tailwind purges class names it can't see
// statically in source, and "Assess" is a display label, not the stored
// `assessment` enum value (L104).
export const STAGES = [
  { value: "saved", label: "Saved", colorClass: "bg-muted" },
  { value: "applied", label: "Applied", colorClass: "bg-primary" },
  { value: "assessment", label: "Assess", colorClass: "bg-warning" },
  { value: "interview", label: "Interview", colorClass: "bg-violet" },
  { value: "offer", label: "Offer", colorClass: "bg-success" },
  { value: "rejected", label: "Rejected", colorClass: "bg-danger" },
] as const;
