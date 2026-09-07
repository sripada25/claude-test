import {
  findUserApplicationById,
  findUserApplications,
  insertApplication,
  type Application,
  type ApplicationListItem,
  type ApplicationSort,
  type ApplicationSource,
  type ApplicationStatus,
} from "../repositories/application.ts";
import { isAllowedUrlScheme } from "../security/url-scheme.ts";

const VALID_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "assessment",
  "interview",
  "offer",
  "rejected",
];

const VALID_SOURCES: ApplicationSource[] = [
  "linkedin",
  "naukri",
  "indeed",
  "referral",
  "company_site",
  "other",
];

const MAX_JOB_DESCRIPTION_LENGTH = 15000;

const VALID_SORTS: ApplicationSort[] = ["recent", "oldest_activity", "date_applied", "company_az"];

export interface CreateApplicationInput {
  company: string;
  role: string;
  status?: ApplicationStatus;
  jobDescription?: string | null;
  source?: ApplicationSource | null;
  sourceUrl?: string | null;
  dateApplied?: string | null;
}

export type CreateApplicationResult =
  | { success: true; application: Application }
  | {
      success: false;
      reason:
        | "missing_company"
        | "missing_role"
        | "invalid_status"
        | "invalid_source"
        | "invalid_source_url"
        | "job_description_too_long";
    };

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
): Promise<CreateApplicationResult> {
  const company = input.company.trim();
  const role = input.role.trim();

  if (!company) {
    return { success: false, reason: "missing_company" };
  }
  if (!role) {
    return { success: false, reason: "missing_role" };
  }

  const status = input.status ?? "saved";
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, reason: "invalid_status" };
  }

  if (input.source != null && !VALID_SOURCES.includes(input.source)) {
    return { success: false, reason: "invalid_source" };
  }

  if (input.sourceUrl != null && !isAllowedUrlScheme(input.sourceUrl)) {
    return { success: false, reason: "invalid_source_url" };
  }

  if (input.jobDescription != null && input.jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return { success: false, reason: "job_description_too_long" };
  }

  const application = await insertApplication(userId, {
    company,
    role,
    status,
    jobDescription: input.jobDescription ?? null,
    source: input.source ?? null,
    sourceUrl: input.sourceUrl ?? null,
    dateApplied: input.dateApplied ?? null,
  });

  return { success: true, application };
}

export function getApplication(userId: string, id: string): Promise<Application | null> {
  return findUserApplicationById(userId, id);
}

export interface RawListFilters {
  q?: string;
  status?: string[];
  source?: string[];
  sort?: string;
}

// Filter values are validated/normalized here (BACKEND.md - the repository
// only executes SQL), never passed through raw. Unrecognized status/source
// values are dropped rather than rejected: a malformed filter shouldn't
// break board load. An unrecognized sort falls back to the default, never
// reaches the repository's fixed ORDER BY lookup unresolved.
export function listApplications(
  userId: string,
  raw: RawListFilters,
): Promise<ApplicationListItem[]> {
  const q = raw.q?.trim() || undefined;

  const statuses = (raw.status ?? []).filter((value): value is ApplicationStatus =>
    VALID_STATUSES.includes(value as ApplicationStatus),
  );

  const sources = (raw.source ?? []).filter((value): value is ApplicationSource =>
    VALID_SOURCES.includes(value as ApplicationSource),
  );

  const sort = VALID_SORTS.includes(raw.sort as ApplicationSort)
    ? (raw.sort as ApplicationSort)
    : "recent";

  return findUserApplications(userId, { q, statuses, sources, sort });
}
