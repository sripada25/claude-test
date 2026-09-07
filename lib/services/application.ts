import { pool } from "../db.ts";
import { insertApplicationEvent } from "../repositories/application-event.ts";
import {
  findUserApplicationById,
  findUserApplications,
  insertApplication,
  updateApplicationFields,
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

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  assessment: "Assess",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const application = await insertApplication(client, userId, {
      company,
      role,
      status,
      jobDescription: input.jobDescription ?? null,
      source: input.source ?? null,
      sourceUrl: input.sourceUrl ?? null,
      dateApplied: input.dateApplied ?? null,
    });

    await insertApplicationEvent(client, {
      applicationId: application.id,
      userId,
      type: "created",
      description: "Application created",
    });

    await client.query("COMMIT");
    return { success: true, application };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function getApplication(userId: string, id: string): Promise<Application | null> {
  return findUserApplicationById(userId, id);
}

export interface UpdateApplicationInput {
  company?: string;
  role?: string;
  status?: ApplicationStatus;
  jobDescription?: string | null;
  source?: ApplicationSource | null;
  sourceUrl?: string | null;
  dateApplied?: string | null;
  notes?: string | null;
}

export type UpdateApplicationResult =
  | { success: true; application: Application }
  | {
      success: false;
      reason:
        | "not_found"
        | "missing_company"
        | "missing_role"
        | "invalid_status"
        | "invalid_source"
        | "invalid_source_url"
        | "job_description_too_long";
    };

// Same service function the board drag will call later (M05-02's doc: "one
// code path, two entry points") - only the caller differs, not this
// function. Only status and notes changes write a timeline event, matching
// what event_type actually supports; other field edits apply with none.
export async function updateApplication(
  userId: string,
  id: string,
  patch: UpdateApplicationInput,
): Promise<UpdateApplicationResult> {
  const current = await findUserApplicationById(userId, id);
  if (!current) {
    return { success: false, reason: "not_found" };
  }

  const company = patch.company !== undefined ? patch.company.trim() : current.company;
  const role = patch.role !== undefined ? patch.role.trim() : current.role;
  if (!company) {
    return { success: false, reason: "missing_company" };
  }
  if (!role) {
    return { success: false, reason: "missing_role" };
  }

  const status = patch.status ?? current.status;
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, reason: "invalid_status" };
  }

  const source = patch.source !== undefined ? patch.source : current.source;
  if (source != null && !VALID_SOURCES.includes(source)) {
    return { success: false, reason: "invalid_source" };
  }

  const sourceUrl = patch.sourceUrl !== undefined ? patch.sourceUrl : current.sourceUrl;
  if (sourceUrl != null && !isAllowedUrlScheme(sourceUrl)) {
    return { success: false, reason: "invalid_source_url" };
  }

  const jobDescription =
    patch.jobDescription !== undefined ? patch.jobDescription : current.jobDescription;
  if (jobDescription != null && jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return { success: false, reason: "job_description_too_long" };
  }

  const dateApplied = patch.dateApplied !== undefined ? patch.dateApplied : current.dateApplied;
  const notes = patch.notes !== undefined ? patch.notes : current.notes;

  const statusChanged = status !== current.status;
  const notesChanged = notes !== current.notes;
  const jobDescriptionChanged = jobDescription !== current.jobDescription;
  const bumpActivity = statusChanged || notesChanged || jobDescriptionChanged;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updated = await updateApplicationFields(client, userId, id, {
      company,
      role,
      status,
      jobDescription,
      source,
      sourceUrl,
      dateApplied,
      notes,
      lastActivityAt: bumpActivity ? new Date() : current.lastActivityAt,
    });

    if (!updated) {
      await client.query("ROLLBACK");
      return { success: false, reason: "not_found" };
    }

    if (statusChanged) {
      await insertApplicationEvent(client, {
        applicationId: id,
        userId,
        type: "status_changed",
        description: `Status changed to ${STATUS_LABELS[status]}`,
        metadata: { from: current.status, to: status },
      });
    }

    if (notesChanged) {
      await insertApplicationEvent(client, {
        applicationId: id,
        userId,
        type: "note_updated",
        description: "Note updated",
      });
    }

    await client.query("COMMIT");
    return { success: true, application: updated };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
