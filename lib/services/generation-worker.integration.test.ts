import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProvider } from "../ai/types.ts";

const getAIProviderMock = vi.fn();
const getAIProviderMetadataMock = vi.fn();
const refundGenerationQuotaMock = vi.fn();

vi.mock("../ai/provider.ts", () => ({
  getAIProvider: () => getAIProviderMock(),
  getAIProviderMetadata: () => getAIProviderMetadataMock(),
}));

vi.mock("./subscription.ts", () => ({
  refundGenerationQuota: (...args: unknown[]) => refundGenerationQuotaMock(...args),
}));

describe("generation-worker service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let processNextJob: typeof import("./generation-worker.ts")["processNextJob"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ processNextJob } = await import("./generation-worker.ts"));

    await migrate.up();
  }, 60_000);

  beforeEach(() => {
    getAIProviderMetadataMock.mockReturnValue({ provider: "gemini", model: "gemini-flash-latest" });
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users");
    getAIProviderMock.mockReset();
    getAIProviderMetadataMock.mockReset();
    refundGenerationQuotaMock.mockReset();
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
    type: "cover_letter" | "resume",
    promptInputs: unknown,
    quotaMechanism: "trial" | "free" | null = null,
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs, quota_mechanism)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, applicationId, type, JSON.stringify(promptInputs), quotaMechanism],
    );
    return result.rows[0].id;
  }

  function fakeProvider(overrides: Partial<AIProvider>): AIProvider {
    return {
      extractProfile: vi.fn(),
      generateCoverLetter: vi.fn(),
      generateResume: vi.fn(),
      structureCallNote: vi.fn(),
      draftFollowUp: vi.fn(),
      ...overrides,
    };
  }

  it("returns no-job when the queue is empty", async () => {
    getAIProviderMock.mockReturnValue(fakeProvider({}));

    const outcome = await processNextJob();

    expect(outcome).toBe("no-job");
  });

  it("succeeds a cover_letter job: writes a documents row and marks it succeeded", async () => {
    const userId = await insertUser("coverletter@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "Original JD text", companyName: "Acme Corp" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);

    const generateCoverLetter = vi
      .fn()
      .mockResolvedValue({ success: true, data: { content: "Dear Acme Corp, ...", tokensIn: 2200, tokensOut: 600 } });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("succeeded");
    expect(generateCoverLetter).toHaveBeenCalledWith(promptInputs);

    const job = await pool.query("SELECT status FROM generation_jobs WHERE id = $1", [jobId]);
    expect(job.rows[0].status).toBe("succeeded");

    const document = await pool.query(
      "SELECT application_id, user_id, type, content, jd_snapshot, provider, model FROM documents WHERE application_id = $1",
      [applicationId],
    );
    expect(document.rows).toHaveLength(1);
    expect(document.rows[0]).toMatchObject({
      application_id: applicationId,
      user_id: userId,
      type: "cover_letter",
      content: "Dear Acme Corp, ...",
      jd_snapshot: "Original JD text",
      provider: "gemini",
      model: "gemini-flash-latest",
    });

    const usage = await pool.query(
      "SELECT user_id, job_id, provider, model, operation, tokens_in, tokens_out, cost_estimate, status, error_class FROM ai_usage WHERE job_id = $1",
      [jobId],
    );
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({
      user_id: userId,
      job_id: jobId,
      provider: "gemini",
      model: "gemini-flash-latest",
      operation: "cover_letter",
      tokens_in: 2200,
      tokens_out: 600,
      cost_estimate: null,
      status: "succeeded",
      error_class: null,
    });
  });

  it("dispatches a resume job to generateResume, not generateCoverLetter", async () => {
    const userId = await insertUser("resume@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    await insertJob(userId, applicationId, "resume", promptInputs);

    const generateResume = vi
      .fn()
      .mockResolvedValue({ success: true, data: { content: "A tailored resume.", tokensIn: 1800, tokensOut: 700 } });
    const generateCoverLetter = vi.fn();
    getAIProviderMock.mockReturnValue(fakeProvider({ generateResume, generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("succeeded");
    expect(generateResume).toHaveBeenCalledWith(promptInputs);
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("requeues on a retryable failure at attempt 1, rather than marking it failed", async () => {
    const userId = await insertUser("retry-transient@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);

    const generateCoverLetter = vi.fn().mockResolvedValue({
      success: false,
      error: { errorClass: "rate_limited", message: "too many requests" },
    });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("retrying");
    const job = await pool.query<{ status: string; attempts: number; next_attempt_at: Date }>(
      "SELECT status, attempts, next_attempt_at FROM generation_jobs WHERE id = $1",
      [jobId],
    );
    expect(job.rows[0].status).toBe("queued");
    expect(job.rows[0].attempts).toBe(1);
    expect(job.rows[0].next_attempt_at.getTime()).toBeGreaterThan(Date.now());

    const documents = await pool.query("SELECT id FROM documents WHERE application_id = $1", [applicationId]);
    expect(documents.rows).toHaveLength(0);

    const usage = await pool.query(
      "SELECT tokens_in, tokens_out, cost_estimate, status, error_class FROM ai_usage WHERE job_id = $1",
      [jobId],
    );
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({
      tokens_in: null,
      tokens_out: null,
      cost_estimate: null,
      status: "failed",
      error_class: "rate_limited",
    });
  });

  it("writes one ai_usage row per attempt when a job retries then succeeds", async () => {
    const userId = await insertUser("retry-then-succeed@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);

    const generateCoverLetter = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: { errorClass: "timeout", message: "timed out" } })
      .mockResolvedValueOnce({ success: true, data: { content: "Dear Acme, ...", tokensIn: 100, tokensOut: 50 } });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const firstOutcome = await processNextJob();
    expect(firstOutcome).toBe("retrying");

    await pool.query("UPDATE generation_jobs SET next_attempt_at = NULL WHERE id = $1", [jobId]);
    const secondOutcome = await processNextJob();
    expect(secondOutcome).toBe("succeeded");

    const usage = await pool.query("SELECT status, error_class FROM ai_usage WHERE job_id = $1 ORDER BY created_at", [
      jobId,
    ]);
    expect(usage.rows).toEqual([
      { status: "failed", error_class: "timeout" },
      { status: "succeeded", error_class: null },
    ]);
  });

  it("fails terminally on a retryable-class failure once attempts is already at the cap", async () => {
    const userId = await insertUser("retry-exhausted@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);
    await pool.query("UPDATE generation_jobs SET attempts = 1 WHERE id = $1", [jobId]);

    const generateCoverLetter = vi.fn().mockResolvedValue({
      success: false,
      error: { errorClass: "unavailable", message: "still down" },
    });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("failed");
    const job = await pool.query<{ status: string; error_class: string }>(
      "SELECT status, error_class FROM generation_jobs WHERE id = $1",
      [jobId],
    );
    expect(job.rows[0]).toMatchObject({ status: "failed", error_class: "unavailable" });
  });

  it("fails terminally on a permanent-class failure even with attempts remaining", async () => {
    const userId = await insertUser("permanent-failure@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);

    const generateCoverLetter = vi.fn().mockResolvedValue({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("failed");
    const job = await pool.query<{ status: string; attempts: number; error_class: string }>(
      "SELECT status, attempts, error_class FROM generation_jobs WHERE id = $1",
      [jobId],
    );
    expect(job.rows[0]).toMatchObject({ status: "failed", attempts: 1, error_class: "safety_block" });
    expect(refundGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("refunds the correct quota mechanism on a terminal failure", async () => {
    const userId = await insertUser("refund-terminal@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    await insertJob(userId, applicationId, "cover_letter", promptInputs, "trial");

    const generateCoverLetter = vi.fn().mockResolvedValue({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("failed");
    expect(refundGenerationQuotaMock).toHaveBeenCalledExactlyOnceWith(userId, "trial");
  });

  it("does not refund on a retry - only on the eventual terminal outcome", async () => {
    const userId = await insertUser("refund-not-on-retry@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs, "free");

    const generateCoverLetter = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: { errorClass: "timeout", message: "timed out" } })
      .mockResolvedValueOnce({ success: false, error: { errorClass: "unavailable", message: "still down" } });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const firstOutcome = await processNextJob();
    expect(firstOutcome).toBe("retrying");
    expect(refundGenerationQuotaMock).not.toHaveBeenCalled();

    await pool.query("UPDATE generation_jobs SET next_attempt_at = NULL WHERE id = $1", [jobId]);
    const secondOutcome = await processNextJob();

    expect(secondOutcome).toBe("failed");
    expect(refundGenerationQuotaMock).toHaveBeenCalledExactlyOnceWith(userId, "free");
  });

  it("does not refund on success", async () => {
    const userId = await insertUser("no-refund-success@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    await insertJob(userId, applicationId, "cover_letter", promptInputs, "trial");

    const generateCoverLetter = vi
      .fn()
      .mockResolvedValue({ success: true, data: { content: "Dear Acme, ...", tokensIn: 100, tokensOut: 50 } });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("succeeded");
    expect(refundGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("marks a job failed with its real error class and writes no document", async () => {
    const userId = await insertUser("failure@example.com");
    const applicationId = await insertApplication(userId);
    const promptInputs = { profile: { skills: [] }, jobDescription: "JD", companyName: "Acme" };
    const jobId = await insertJob(userId, applicationId, "cover_letter", promptInputs);

    const generateCoverLetter = vi.fn().mockResolvedValue({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });
    getAIProviderMock.mockReturnValue(fakeProvider({ generateCoverLetter }));

    const outcome = await processNextJob();

    expect(outcome).toBe("failed");

    const job = await pool.query("SELECT status, error_class FROM generation_jobs WHERE id = $1", [jobId]);
    expect(job.rows[0]).toMatchObject({ status: "failed", error_class: "safety_block" });

    const documents = await pool.query("SELECT id FROM documents WHERE application_id = $1", [applicationId]);
    expect(documents.rows).toHaveLength(0);
  });
});
