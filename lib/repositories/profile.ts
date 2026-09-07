import { pool } from "../db.ts";

export type SalaryPeriod = "monthly" | "annual";
export type LocationPreference = "remote" | "hybrid" | "onsite";

export interface Profile {
  fullName: string;
  currentRole: string | null;
  targetRole: string | null;
  contactEmail: string | null;
  yearsExperience: number | null;
  monthsExperience: number | null;
  skills: string[];
  salaryAmount: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  locationPreference: LocationPreference | null;
  completedAt: Date | null;
}

interface ProfileRow {
  full_name: string;
  current_role: string | null;
  target_role: string | null;
  contact_email: string | null;
  years_experience: number | null;
  months_experience: number | null;
  skills: string[];
  salary_amount: string | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod | null;
  location_preference: LocationPreference | null;
  completed_at: Date | null;
}

function toProfile(row: ProfileRow): Profile {
  return {
    fullName: row.full_name,
    currentRole: row.current_role,
    targetRole: row.target_role,
    contactEmail: row.contact_email,
    yearsExperience: row.years_experience,
    monthsExperience: row.months_experience,
    skills: row.skills,
    salaryAmount: row.salary_amount === null ? null : Number(row.salary_amount),
    salaryCurrency: row.salary_currency,
    salaryPeriod: row.salary_period,
    locationPreference: row.location_preference,
    completedAt: row.completed_at,
  };
}

export async function findProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await pool.query<ProfileRow>(
    `SELECT full_name, "current_role", target_role, contact_email, years_experience,
            months_experience, skills, salary_amount, salary_currency, salary_period,
            location_preference, completed_at
     FROM profiles WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ? toProfile(result.rows[0]) : null;
}

// Full static column list every time (read-modify-write from the service),
// not a dynamically-built SQL statement - matches updateEmail/
// updatePasswordHash's style elsewhere in this codebase.
export async function updateProfileFields(
  userId: string,
  profile: Pick<
    Profile,
    | "fullName"
    | "currentRole"
    | "targetRole"
    | "contactEmail"
    | "yearsExperience"
    | "monthsExperience"
    | "skills"
    | "salaryAmount"
    | "salaryCurrency"
    | "salaryPeriod"
    | "locationPreference"
    | "completedAt"
  >,
): Promise<void> {
  await pool.query(
    `UPDATE profiles
     SET full_name = $2, "current_role" = $3, target_role = $4, contact_email = $5,
         years_experience = $6, months_experience = $7, skills = $8,
         salary_amount = $9, salary_currency = $10, salary_period = $11,
         location_preference = $12, completed_at = $13, updated_at = now()
     WHERE user_id = $1`,
    [
      userId,
      profile.fullName,
      profile.currentRole,
      profile.targetRole,
      profile.contactEmail,
      profile.yearsExperience,
      profile.monthsExperience,
      profile.skills,
      profile.salaryAmount,
      profile.salaryCurrency,
      profile.salaryPeriod,
      profile.locationPreference,
      profile.completedAt,
    ],
  );
}
