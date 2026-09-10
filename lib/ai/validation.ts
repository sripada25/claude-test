// Shared, provider-agnostic output-safety checks (AI-RULES.md §2.3,
// SECURITY_quarterfinal.md §13.2). Each check returns a rejection reason, or
// null if the text passes. Callers compose whatever subset and bounds apply
// to their operation - this module doesn't decide which checks apply where.

const INJECTION_MARKERS = [
  "ignore previous",
  "ignore all previous",
  "disregard previous",
  "system prompt",
  "you are now",
];

export function checkNotEmpty(text: string): string | null {
  return text.trim() === "" ? "Output is empty." : null;
}

// Matches the original cover-letter check bit-for-bit: the minimum compares
// trimmed length, the maximum compares untrimmed length. Not "fixed" here -
// this is a pure extraction, not a behavior change.
export function checkLength(text: string, bounds: { min?: number; max?: number }): string | null {
  if (bounds.min !== undefined && text.trim().length < bounds.min) {
    return `Output is under ${bounds.min} characters.`;
  }
  if (bounds.max !== undefined && text.length > bounds.max) {
    return `Output is over ${bounds.max} characters.`;
  }
  return null;
}

export function checkNoPlaceholderBrackets(text: string): string | null {
  return text.includes("[") || text.includes("]") ? "Output contains placeholder brackets." : null;
}

export function checkNoInjectionMarkers(text: string): string | null {
  const lower = text.toLowerCase();
  return INJECTION_MARKERS.some((marker) => lower.includes(marker))
    ? "Output contains an injection marker."
    : null;
}
