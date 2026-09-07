// The one AIProvider shape every adapter (Gemini now, others later per L060)
// and every consuming service (F3 generation, F4 follow-ups, F5 call notes)
// builds against. See AI-RULES.md §1.

export type AIErrorClass =
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "bad_request"
  | "safety_block"
  | "validation_failed";

export interface AIError {
  errorClass: AIErrorClass;
  message: string;
}

export type Result<T> = { success: true; data: T } | { success: false; error: AIError };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err(errorClass: AIErrorClass, message: string): Result<never> {
  return { success: false, error: { errorClass, message } };
}

// AI-RULES.md §3's output schema.
export interface ExtractedProfile {
  fullName: string | null;
  currentRole: string | null;
  targetRole: string | null;
  yearsExperience: number | null;
  monthsExperience: number | null;
  skills: string[];
  contactEmail: string | null;
  location: string | null;
}

// Resolved at enqueue (L095), not fetched at execution.
export interface ProfileSnapshot {
  fullName: string;
  currentRole: string | null;
  targetRole: string | null;
  yearsExperience: number | null;
  monthsExperience: number | null;
  skills: string[];
  location: string | null;
}

export interface GenerationInput {
  profile: ProfileSnapshot;
  jobDescription: string;
  companyName: string;
  baseResumeText?: string;
}

export interface CallNoteInput {
  question1Answer: string;
  question2Answer: string;
  question3Answer: string;
}

// AI-RULES.md §6.1's output schema.
export interface StructuredNote {
  summary: string;
  salaryMentioned: string | null;
  contactName: string | null;
  contactRole: string | null;
  nextStep: string | null;
  followUpDate: string | null;
}

export interface FollowUpInput {
  companyName: string;
  roleTitle: string;
  daysSinceApplied: number;
  lastCallNotes?: string;
}

export interface AIProvider {
  extractProfile(pdf: Buffer): Promise<Result<ExtractedProfile>>;
  generateCoverLetter(input: GenerationInput): Promise<Result<string>>;
  generateResume(input: GenerationInput): Promise<Result<string>>;
  structureCallNote(input: CallNoteInput): Promise<Result<StructuredNote>>;
  draftFollowUp(input: FollowUpInput): Promise<Result<string>>;
}
