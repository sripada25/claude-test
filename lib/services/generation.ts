import type { GenerationInput } from "../ai/types.ts";
import { getApplication } from "./application.ts";
import { listEmploymentHistory } from "./employment-history.ts";
import { getProfile } from "./profile.ts";
import { consumeGenerationQuota } from "./subscription.ts";
import { findSubscriptionByUserId } from "../repositories/subscription.ts";
import { findUserById } from "../repositories/user.ts";
import {
  countPendingJobsForUser,
  findJobForUser,
  insertGenerationJob,
  type DocumentType,
} from "../repositories/generation-jobs.ts";
import { findDocumentByJobId, findDocumentForUser, type GeneratedDocument } from "../repositories/documents.ts";

// L094: 2 pending jobs free/trial, 5 Pro.
const QUEUE_DEPTH_CAP_DEFAULT = 2;
const QUEUE_DEPTH_CAP_PRO = 5;

export type EnqueueGenerationResult =
  | { success: true; jobId: string }
  | {
      success: false;
      reason:
        | "not_found"
        | "no_job_description"
        | "email_not_verified"
        | "profile_incomplete"
        | "queue_depth_exceeded"
        | "quota_exhausted"
        | "not_implemented";
    };

// The first real caller of every F3 primitive built so far. Checks are
// ordered read-only-first, mutating-last (consumeGenerationQuota actually
// decrements a counter) so a rejection never needs an immediate
// compensating refund.
export async function enqueueGeneration(
  userId: string,
  applicationId: string,
  type: DocumentType,
): Promise<EnqueueGenerationResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }
  if (!application.jobDescription) {
    return { success: false, reason: "no_job_description" };
  }

  const user = await findUserById(userId);
  if (!user?.emailVerifiedAt) {
    return { success: false, reason: "email_not_verified" };
  }

  const profile = await getProfile(userId);
  if (!profile.completedAt) {
    return { success: false, reason: "profile_incomplete" };
  }

  const subscription = await findSubscriptionByUserId(userId);
  const queueDepthCap = subscription?.tier === "pro" ? QUEUE_DEPTH_CAP_PRO : QUEUE_DEPTH_CAP_DEFAULT;
  const pendingCount = await countPendingJobsForUser(userId);
  if (pendingCount >= queueDepthCap) {
    return { success: false, reason: "queue_depth_exceeded" };
  }

  const quotaResult = await consumeGenerationQuota(userId);
  if (!quotaResult.allowed) {
    return { success: false, reason: quotaResult.reason };
  }

  const employmentHistory = await listEmploymentHistory(userId);

  const promptInputs: GenerationInput = {
    profile: {
      fullName: profile.fullName,
      currentRole: profile.currentRole,
      targetRole: profile.targetRole,
      yearsExperience: profile.yearsExperience,
      monthsExperience: profile.monthsExperience,
      skills: profile.skills,
      // profiles has no free-text location/city column - only
      // location_preference (remote/hybrid/onsite, a different concept).
      // Left null rather than misusing that field.
      location: null,
      employmentHistory: employmentHistory.map((entry) => ({
        employer: entry.employer,
        title: entry.title,
        startDate: entry.startDate,
        endDate: entry.endDate,
      })),
    },
    jobDescription: application.jobDescription,
    companyName: application.company,
    // baseResumeText intentionally omitted - nothing stores a user's base
    // résumé text anywhere (parse-resume persists nothing), and no M06 UI
    // element re-uploads one at generate time.
  };

  const jobId = await insertGenerationJob({
    userId,
    applicationId,
    type,
    promptInputs,
    quotaMechanism: quotaResult.mechanism,
  });

  return { success: true, jobId };
}

export type GenerationStatusResult =
  | { success: false; reason: "not_found" }
  | { success: true; status: "queued" | "running" }
  | { success: true; status: "succeeded"; document: GeneratedDocument }
  | { success: true; status: "failed"; errorClass: string };

// AI-RULES.md §8.1: retries are invisible - a job mid-retry still reports
// "queued", the same as it would before its first attempt. Only the four
// real job_status values are ever exposed; there's no separate "retrying"
// state.
export async function getGenerationStatus(userId: string, jobId: string): Promise<GenerationStatusResult> {
  const job = await findJobForUser(jobId, userId);
  if (!job) {
    return { success: false, reason: "not_found" };
  }

  if (job.status === "queued" || job.status === "running") {
    return { success: true, status: job.status };
  }

  if (job.status === "failed") {
    return { success: true, status: "failed", errorClass: job.errorClass ?? "unavailable" };
  }

  const document = await findDocumentByJobId(jobId);
  if (!document) {
    throw new Error(`Job ${jobId} is succeeded but has no matching document`);
  }
  return { success: true, status: "succeeded", document };
}

// Regenerating is a fresh generation for the same application/type - a
// thin wrapper, not a second generation pathway. Every precondition
// enqueueGeneration already enforces (quota, queue depth, profile, email)
// applies identically here, unchanged.
export async function regenerateDocument(userId: string, documentId: string): Promise<EnqueueGenerationResult> {
  const document = await findDocumentForUser(documentId, userId);
  if (!document) {
    return { success: false, reason: "not_found" };
  }
  return enqueueGeneration(userId, document.applicationId, document.type);
}
