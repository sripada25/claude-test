import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("generation-jobs repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let claimNextQueuedJob: typeof import("./generation-jobs.ts")["claimNextQueuedJob"];
  let markJobSucceeded: typeof import("./generation-jobs.ts")["markJobSucceeded"];
  let markJobFailed: typeof import("./generation-jobs.ts")["markJobFailed"];
  let requeueForRetry: typeof import("./generation-jobs.ts")["requeueForRetry"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ claimNextQueuedJob, markJobSucceeded, markJobFailed, requeueForRetry } = await import("./generation-jobs.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    return result.rows[0].id;
  }

  async function insertApplication(userId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme Corp', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertJob(
    userId: string,
    applicationId: string,
    type: "cover_letter" | "resume" = "cover_letter",
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, applicationId, type, JSON.stringify({ profile: {}, jobDescription: "JD", companyName: "Acme" })],
    );
    return result.rows[0].id;
  }

  async function getJobStatus(jobId: string): Promise<{ status: string; attempts: number; error_class: string | null }> {
    const result = await pool.query<{ status: string; attempts: number; error_class: string | null }>(
      "SELECT status, attempts, error_class FROM generation_jobs WHERE id = $1",
      [jobId],
    );
    return result.rows[0];
  }

  it("claims the oldest queued job, marks it running, and increments attempts", async () => {
    const userId = await insertUser("claim@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);

    const claimed = await claimNextQueuedJob();

    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(jobId);
    expect(claimed?.userId).toBe(userId);
    expect(claimed?.applicationId).toBe(applicationId);
    expect(claimed?.type).toBe("cover_letter");

    const status = await getJobStatus(jobId);
    expect(status.status).toBe("running");
    expect(status.attempts).toBe(1);
  });

  it("claims in created_at order, oldest first", async () => {
    const userId = await insertUser("order@example.com");
    const applicationId = await insertApplication(userId);
    const firstJobId = await insertJob(userId, applicationId);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await insertJob(userId, applicationId);

    const claimed = await claimNextQueuedJob();

    expect(claimed?.id).toBe(firstJobId);
  });

  it("returns null when the queue is empty", async () => {
    const claimed = await claimNextQueuedJob();
    expect(claimed).toBeNull();
  });

  it("never re-claims a job already running or completed", async () => {
    const userId = await insertUser("norepeat@example.com");
    const applicationId = await insertApplication(userId);
    await insertJob(userId, applicationId);

    const first = await claimNextQueuedJob();
    const second = await claimNextQueuedJob();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("lets concurrent claims each get a different queued job (SKIP LOCKED)", async () => {
    const userId = await insertUser("concurrent@example.com");
    const applicationId = await insertApplication(userId);
    const jobIdA = await insertJob(userId, applicationId);
    const jobIdB = await insertJob(userId, applicationId);

    const [claimedA, claimedB] = await Promise.all([claimNextQueuedJob(), claimNextQueuedJob()]);

    const claimedIds = [claimedA?.id, claimedB?.id].sort();
    expect(claimedIds).toEqual([jobIdA, jobIdB].sort());
  });

  it("skips a queued job whose next_attempt_at is still in the future", async () => {
    const userId = await insertUser("backing-off@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);
    await pool.query("UPDATE generation_jobs SET status = 'queued', next_attempt_at = now() + interval '1 hour' WHERE id = $1", [
      jobId,
    ]);

    const claimed = await claimNextQueuedJob();

    expect(claimed).toBeNull();
  });

  it("claims a queued job whose next_attempt_at has already passed", async () => {
    const userId = await insertUser("backoff-elapsed@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);
    await pool.query(
      "UPDATE generation_jobs SET status = 'queued', next_attempt_at = now() - interval '1 second' WHERE id = $1",
      [jobId],
    );

    const claimed = await claimNextQueuedJob();

    expect(claimed?.id).toBe(jobId);
  });

  it("requeues a job for retry, setting status back to queued and next_attempt_at in the future, without touching attempts", async () => {
    const userId = await insertUser("requeue@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);
    await claimNextQueuedJob();

    await requeueForRetry(pool, jobId, 2);

    const row = await pool.query<{ status: string; attempts: number; next_attempt_at: Date }>(
      "SELECT status, attempts, next_attempt_at FROM generation_jobs WHERE id = $1",
      [jobId],
    );
    expect(row.rows[0].status).toBe("queued");
    expect(row.rows[0].attempts).toBe(1);
    expect(row.rows[0].next_attempt_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("marks a job succeeded", async () => {
    const userId = await insertUser("succeed@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);
    await claimNextQueuedJob();

    await markJobSucceeded(pool, jobId);

    const status = await getJobStatus(jobId);
    expect(status.status).toBe("succeeded");
  });

  it("marks a job failed with its error class", async () => {
    const userId = await insertUser("fail@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId);
    await claimNextQueuedJob();

    await markJobFailed(pool, jobId, "safety_block");

    const status = await getJobStatus(jobId);
    expect(status.status).toBe("failed");
    expect(status.error_class).toBe("safety_block");
  });
});
