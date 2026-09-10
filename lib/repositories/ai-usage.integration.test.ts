import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("ai-usage repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let recordAiUsage: typeof import("./ai-usage.ts")["recordAiUsage"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ recordAiUsage } = await import("./ai-usage.ts"));

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

  it("inserts a full row for a successful call", async () => {
    const userId = await insertUser("full-row@example.com");

    await recordAiUsage({
      userId,
      jobId: null,
      provider: "gemini",
      model: "gemini-flash-latest",
      operation: "cover_letter",
      tokensIn: 2200,
      tokensOut: 600,
      costEstimate: null,
      latencyMs: 850,
      status: "succeeded",
      errorClass: null,
    });

    const result = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      user_id: userId,
      job_id: null,
      provider: "gemini",
      model: "gemini-flash-latest",
      operation: "cover_letter",
      tokens_in: 2200,
      tokens_out: 600,
      cost_estimate: null,
      latency_ms: 850,
      status: "succeeded",
      error_class: null,
    });
  });

  it("accepts null for job_id, tokens, cost_estimate, and error_class together", async () => {
    const userId = await insertUser("all-nulls@example.com");

    await expect(
      recordAiUsage({
        userId,
        jobId: null,
        provider: "gemini",
        model: "gemini-flash-latest",
        operation: "cover_letter",
        tokensIn: null,
        tokensOut: null,
        costEstimate: null,
        latencyMs: 40,
        status: "failed",
        errorClass: null,
      }),
    ).resolves.not.toThrow();
  });

  it("records job_id and error_class for a failed job attempt", async () => {
    const userId = await insertUser("failed-attempt@example.com");
    const jobId = crypto.randomUUID();

    // job_id has no FK constraint on ai_usage (financial/audit record
    // survives even if the job row is later purged) - a bare UUID is fine.
    await recordAiUsage({
      userId,
      jobId,
      provider: "gemini",
      model: "gemini-flash-latest",
      operation: "resume",
      tokensIn: null,
      tokensOut: null,
      costEstimate: null,
      latencyMs: 1200,
      status: "failed",
      errorClass: "safety_block",
    });

    const result = await pool.query("SELECT job_id, status, error_class FROM ai_usage WHERE user_id = $1", [userId]);
    expect(result.rows[0]).toMatchObject({ job_id: jobId, status: "failed", error_class: "safety_block" });
  });
});
