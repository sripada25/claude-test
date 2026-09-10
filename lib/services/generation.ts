import type { GenerationInput } from "../ai/types.ts";
import { getApplication } from "./application.ts";
import { listEmploymentHistory } from "./employment-history.ts";
import { getProfile } from "./profile.ts";
import { consumeGenerationQuota } from "./subscription.ts";
import { findSubscriptionByUserId } from "../repositories/subscription.ts";
import { findUserById } from "../repositories/user.ts";
import { countPendingJobsForUser, insertGenerationJob, type DocumentType } from "../repositories/generation-jobs.ts";

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
