import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("generation service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let enqueueGeneration: typeof import("./generation.ts")["enqueueGeneration"];
  let getGenerationStatus: typeof import("./generation.ts")["getGenerationStatus"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ enqueueGeneration, getGenerationStatus } = await import("./generation.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  interface SetupOverrides {
    emailVerified?: boolean;
    profileComplete?: boolean;
    subscriptionStatus?: string;
    subscriptionTier?: string;
    trialGenerationsUsed?: number;
    jobDescription?: string | null;
    quotaUsed?: number;
    pendingJobs?: number;
  }

  // Everything a real generate request needs to succeed, each piece
  // individually overridable so each test can knock out exactly one
  // precondition.
  async function setupReadyToGenerate(email: string, overrides: SetupOverrides = {}): Promise<{
    userId: string;
    applicationId: string;
  }> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone, email_verified_at) VALUES ($1, 'Asia/Kolkata', $2) RETURNING id",
      [email, overrides.emailVerified === false ? null : new Date()],
    );
    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO subscriptions (user_id, status, tier, trial_generations_used)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        overrides.subscriptionStatus ?? "active",
        overrides.subscriptionTier ?? "free",
        overrides.trialGenerationsUsed ?? 0,
      ],
    );

    const profileComplete = overrides.profileComplete !== false;
    await pool.query(
      `INSERT INTO profiles (user_id, full_name, target_role, skills, years_experience, months_experience, completed_at)
       VALUES ($1, 'Jane Doe', $2, $3, $4, $5, $6)`,
      [
        userId,
        profileComplete ? "Senior Engineer" : null,
        profileComplete ? ["react"] : [],
        profileComplete ? 3 : null,
        profileComplete ? 0 : null,
        profileComplete ? new Date() : null,
      ],
    );

    const applicationResult = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, job_description) VALUES ($1, 'Acme', 'Engineer', $2) RETURNING id`,
      [userId, overrides.jobDescription === undefined ? "A job description" : overrides.jobDescription],
    );
    const applicationId = applicationResult.rows[0].id;

    if (overrides.quotaUsed) {
      const periodStart = new Date();
      periodStart.setUTCDate(1);
      await pool.query(`INSERT INTO generation_quota (user_id, period_start, used) VALUES ($1, $2, $3)`, [
        userId,
        periodStart.toISOString().slice(0, 10),
        overrides.quotaUsed,
      ]);
    }

    for (let i = 0; i < (overrides.pendingJobs ?? 0); i++) {
      await pool.query(
        `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs) VALUES ($1, $2, 'cover_letter', '{}')`,
        [userId, applicationId],
      );
    }

    return { userId, applicationId };
  }

  it("enqueues a queued job with a correctly built GenerationInput", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("happy-path@example.com");
    await pool.query(
      `INSERT INTO employment_history (user_id, employer, title, start_date, end_date)
       VALUES ($1, 'Acme Corp', 'Engineer', '2020-01-01', NULL)`,
      [userId],
    );

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const job = await pool.query<{ status: string; type: string; prompt_inputs: unknown; quota_mechanism: string }>(
      "SELECT status, type, prompt_inputs, quota_mechanism FROM generation_jobs WHERE id = $1",
      [result.jobId],
    );
    expect(job.rows[0].status).toBe("queued");
    expect(job.rows[0].type).toBe("cover_letter");
    expect(job.rows[0].quota_mechanism).toBe("free");
    expect(job.rows[0].prompt_inputs).toMatchObject({
      jobDescription: "A job description",
      companyName: "Acme",
      profile: {
        fullName: "Jane Doe",
        targetRole: "Senior Engineer",
        location: null,
        employmentHistory: [{ employer: "Acme Corp", title: "Engineer", startDate: "2020-01-01", endDate: null }],
      },
    });
  });

  it("rejects when the application doesn't exist or isn't the user's", async () => {
    const { userId } = await setupReadyToGenerate("not-found@example.com");

    const result = await enqueueGeneration(userId, "00000000-0000-0000-0000-000000000000", "cover_letter");

    expect(result).toEqual({ success: false, reason: "not_found" });
  });

  it("rejects when the application has no job description", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("no-jd@example.com", { jobDescription: null });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "no_job_description" });
  });

  it("rejects when the email isn't verified", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("unverified@example.com", { emailVerified: false });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "email_not_verified" });
  });

  it("rejects when the profile is incomplete", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("incomplete-profile@example.com", {
      profileComplete: false,
    });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "profile_incomplete" });
  });

  it("rejects when the queue depth cap (2, free) is already reached", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("queue-depth@example.com", { pendingJobs: 2 });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "queue_depth_exceeded" });
  });

  it("applies the 5-pending-job cap for Pro, not the 2-job free cap", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("pro-queue-depth@example.com", {
      subscriptionTier: "pro",
      pendingJobs: 4,
    });

    // 4 pending is under Pro's cap of 5, so this must clear the queue-depth
    // check and fail at the (stubbed) quota step instead of
    // queue_depth_exceeded - proving the cap itself is tier-aware, even
    // though Pro's quota consumption isn't implemented yet.
    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "not_implemented" });
  });

  it("rejects when the free monthly quota is exhausted", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("quota-exhausted@example.com", { quotaUsed: 5 });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "quota_exhausted" });
  });

  it("consumes via the trial mechanism for a trialing user", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("trialing@example.com", {
      subscriptionStatus: "trialing",
    });

    const result = await enqueueGeneration(userId, applicationId, "resume");

    expect(result.success).toBe(true);
    if (!result.success) return;
    const job = await pool.query("SELECT quota_mechanism FROM generation_jobs WHERE id = $1", [result.jobId]);
    expect(job.rows[0].quota_mechanism).toBe("trial");
  });

  it("returns not_implemented for a Pro user (unreachable today, stubbed)", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("pro-not-implemented@example.com", {
      subscriptionTier: "pro",
    });

    const result = await enqueueGeneration(userId, applicationId, "cover_letter");

    expect(result).toEqual({ success: false, reason: "not_implemented" });
  });

  describe("getGenerationStatus", () => {
    async function insertRawJob(userId: string, applicationId: string, status: string): Promise<string> {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs, status)
         VALUES ($1, $2, 'cover_letter', '{}', $3) RETURNING id`,
        [userId, applicationId, status],
      );
      return result.rows[0].id;
    }

    it("reports queued", async () => {
      const { userId, applicationId } = await setupReadyToGenerate("status-queued@example.com");
      const jobId = await insertRawJob(userId, applicationId, "queued");

      expect(await getGenerationStatus(userId, jobId)).toEqual({ success: true, status: "queued" });
    });

    it("reports running", async () => {
      const { userId, applicationId } = await setupReadyToGenerate("status-running@example.com");
      const jobId = await insertRawJob(userId, applicationId, "running");

      expect(await getGenerationStatus(userId, jobId)).toEqual({ success: true, status: "running" });
    });

    it("reports failed with the error class", async () => {
      const { userId, applicationId } = await setupReadyToGenerate("status-failed@example.com");
      const jobId = await insertRawJob(userId, applicationId, "failed");
      await pool.query("UPDATE generation_jobs SET error_class = 'safety_block' WHERE id = $1", [jobId]);

      expect(await getGenerationStatus(userId, jobId)).toEqual({
        success: true,
        status: "failed",
        errorClass: "safety_block",
      });
    });

    it("reports succeeded with the generated document", async () => {
      const { userId, applicationId } = await setupReadyToGenerate("status-succeeded@example.com");
      const jobId = await insertRawJob(userId, applicationId, "succeeded");
      const documentResult = await pool.query<{ id: string }>(
        `INSERT INTO documents (application_id, user_id, type, content, provider, model, job_id)
         VALUES ($1, $2, 'cover_letter', 'Dear Acme, ...', 'gemini', 'gemini-flash-latest', $3) RETURNING id`,
        [applicationId, userId, jobId],
      );

      const result = await getGenerationStatus(userId, jobId);

      expect(result.success).toBe(true);
      if (!result.success || result.status !== "succeeded") throw new Error("expected succeeded");
      expect(result.document).toMatchObject({
        id: documentResult.rows[0].id,
        type: "cover_letter",
        content: "Dear Acme, ...",
      });
    });

    it("returns not_found for a job belonging to a different user", async () => {
      const { userId, applicationId } = await setupReadyToGenerate("status-victim@example.com");
      const { userId: attackerId } = await setupReadyToGenerate("status-attacker@example.com");
      const jobId = await insertRawJob(userId, applicationId, "queued");

      expect(await getGenerationStatus(attackerId, jobId)).toEqual({ success: false, reason: "not_found" });
    });

    it("returns not_found for a nonexistent job", async () => {
      const { userId } = await setupReadyToGenerate("status-missing@example.com");

      const result = await getGenerationStatus(userId, "00000000-0000-0000-0000-000000000000");

      expect(result).toEqual({ success: false, reason: "not_found" });
    });
  });
});
