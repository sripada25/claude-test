import {
  findProfileByUserId,
  setContactEmailVerified,
  updateProfileFields,
  type LocationPreference,
  type Profile,
  type SalaryPeriod,
} from "../repositories/profile.ts";
import { canResend, issueOtp, verifyOtp } from "./verification.ts";

const CONTACT_EMAIL_OTP_PURPOSE = "contact_email_verify";

const MAX_SKILLS = 30;

export interface ProfilePatch {
  fullName?: string;
  currentRole?: string | null;
  targetRole?: string | null;
  contactEmail?: string | null;
  yearsExperience?: number | null;
  monthsExperience?: number | null;
  skills?: string[];
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | null;
  locationPreference?: LocationPreference | null;
}

export type UpdateProfileResult =
  | { success: true; profile: Profile }
  | {
      success: false;
      reason: "empty_full_name" | "invalid_experience" | "incomplete_salary";
    };

function normalizeSkills(skills: string[]): string[] {
  const normalized = skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, MAX_SKILLS);
}

// SCREEN-SPEC-M02.md's resolved open item #3: current_role, salary, and
// location_preference are never required - only these five gate generation.
function isComplete(profile: Profile): boolean {
  return (
    profile.fullName.trim() !== "" &&
    profile.targetRole !== null &&
    profile.targetRole.trim() !== "" &&
    profile.skills.length > 0 &&
    profile.yearsExperience !== null &&
    profile.monthsExperience !== null
  );
}

export async function getProfile(userId: string): Promise<Profile> {
  const profile = await findProfileByUserId(userId);
  if (!profile) {
    throw new Error(`No profile row for user ${userId}`);
  }
  return profile;
}

export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<UpdateProfileResult> {
  const current = await findProfileByUserId(userId);
  if (!current) {
    throw new Error(`No profile row for user ${userId}`);
  }

  const merged: Profile = {
    ...current,
    ...(patch.fullName !== undefined && { fullName: patch.fullName }),
    ...(patch.currentRole !== undefined && { currentRole: patch.currentRole }),
    ...(patch.targetRole !== undefined && { targetRole: patch.targetRole }),
    ...(patch.contactEmail !== undefined && { contactEmail: patch.contactEmail }),
    ...(patch.yearsExperience !== undefined && { yearsExperience: patch.yearsExperience }),
    ...(patch.monthsExperience !== undefined && { monthsExperience: patch.monthsExperience }),
    ...(patch.skills !== undefined && { skills: normalizeSkills(patch.skills) }),
    ...(patch.salaryAmount !== undefined && { salaryAmount: patch.salaryAmount }),
    ...(patch.salaryCurrency !== undefined && { salaryCurrency: patch.salaryCurrency }),
    ...(patch.salaryPeriod !== undefined && { salaryPeriod: patch.salaryPeriod }),
    ...(patch.locationPreference !== undefined && {
      locationPreference: patch.locationPreference,
    }),
  };

  if (merged.fullName.trim() === "") {
    return { success: false, reason: "empty_full_name" };
  }

  if (
    (merged.yearsExperience !== null &&
      (merged.yearsExperience < 0 || merged.yearsExperience > 60)) ||
    (merged.monthsExperience !== null &&
      (merged.monthsExperience < 0 || merged.monthsExperience > 11))
  ) {
    return { success: false, reason: "invalid_experience" };
  }

  const salaryFields = [merged.salaryAmount, merged.salaryCurrency, merged.salaryPeriod];
  const salaryFieldsSet = salaryFields.filter((field) => field !== null).length;
  if (salaryFieldsSet !== 0 && salaryFieldsSet !== salaryFields.length) {
    return { success: false, reason: "incomplete_salary" };
  }

  // Recomputed on every save, not a one-time milestone - generation gates on
  // completed_at IS NOT NULL at the moment of generating, so a stale "was
  // once complete" timestamp would let it proceed against a profile that's
  // since lost a required field.
  merged.completedAt = isComplete(merged) ? (current.completedAt ?? new Date()) : null;

  // A verified Reply-To must never survive a change to the address it
  // verified - otherwise a user could verify once, then swap in an
  // unverified address that inherits the old verification for free.
  if (patch.contactEmail !== undefined && patch.contactEmail !== current.contactEmail) {
    merged.contactEmailVerifiedAt = null;
  }

  await updateProfileFields(userId, merged);
  return { success: true, profile: merged };
}

export type IssueContactEmailOtpResult =
  | { success: true }
  | { success: false; reason: "no_contact_email" | "rate_limited" };

export async function issueContactEmailOtp(userId: string): Promise<IssueContactEmailOtpResult> {
  const profile = await getProfile(userId);
  if (!profile.contactEmail) {
    return { success: false, reason: "no_contact_email" };
  }

  if (!(await canResend(userId, CONTACT_EMAIL_OTP_PURPOSE))) {
    return { success: false, reason: "rate_limited" };
  }

  await issueOtp(userId, CONTACT_EMAIL_OTP_PURPOSE, profile.contactEmail);
  return { success: true };
}

export type ConfirmContactEmailOtpResult =
  | { success: true }
  | {
      success: false;
      reason: "expired" | "incorrect" | "locked";
      attemptsRemaining?: number;
    };

export async function confirmContactEmailOtp(
  userId: string,
  code: string,
): Promise<ConfirmContactEmailOtpResult> {
  const result = await verifyOtp(userId, CONTACT_EMAIL_OTP_PURPOSE, code);
  if (!result.success) {
    return result;
  }

  await setContactEmailVerified(userId, new Date());
  return { success: true };
}
