import {
  findProfileByUserId,
  updateProfileFields,
  type LocationPreference,
  type Profile,
  type SalaryPeriod,
} from "../repositories/profile.ts";

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

  await updateProfileFields(userId, merged);
  return { success: true, profile: merged };
}
