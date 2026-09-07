import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("application service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let createApplication: typeof import("./application.ts")["createApplication"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ createApplication } = await import("./application.ts"));

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

  it("creates an application with the full field set", async () => {
    const userId = await insertUser("full@example.com");

    const result = await createApplication(userId, {
      company: "Acme",
      role: "Senior Engineer",
      status: "applied",
      jobDescription: "Build things.",
      source: "linkedin",
      sourceUrl: "https://linkedin.com/jobs/123",
      dateApplied: "2026-09-01",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.application.userId).toBe(userId);
    expect(result.application.company).toBe("Acme");
    expect(result.application.role).toBe("Senior Engineer");
    expect(result.application.status).toBe("applied");
    expect(result.application.jobDescription).toBe("Build things.");
    expect(result.application.source).toBe("linkedin");
    expect(result.application.sourceUrl).toBe("https://linkedin.com/jobs/123");
  });

  it("creates an application with only company and role, defaulting status to saved", async () => {
    const userId = await insertUser("minimal@example.com");

    const result = await createApplication(userId, { company: "Acme", role: "Engineer" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.application.status).toBe("saved");
    expect(result.application.jobDescription).toBeNull();
    expect(result.application.source).toBeNull();
    expect(result.application.sourceUrl).toBeNull();
  });

  it("rejects a missing or blank company", async () => {
    const userId = await insertUser("no-company@example.com");

    expect(await createApplication(userId, { company: "", role: "Engineer" })).toEqual({
      success: false,
      reason: "missing_company",
    });
    expect(await createApplication(userId, { company: "   ", role: "Engineer" })).toEqual({
      success: false,
      reason: "missing_company",
    });
  });

  it("rejects a missing or blank role", async () => {
    const userId = await insertUser("no-role@example.com");

    expect(await createApplication(userId, { company: "Acme", role: "" })).toEqual({
      success: false,
      reason: "missing_role",
    });
  });

  it("rejects an invalid status", async () => {
    const userId = await insertUser("bad-status@example.com");

    const result = await createApplication(userId, {
      company: "Acme",
      role: "Engineer",
      status: "bogus" as never,
    });
    expect(result).toEqual({ success: false, reason: "invalid_status" });
  });

  it("rejects an invalid source", async () => {
    const userId = await insertUser("bad-source@example.com");

    const result = await createApplication(userId, {
      company: "Acme",
      role: "Engineer",
      source: "bogus" as never,
    });
    expect(result).toEqual({ success: false, reason: "invalid_source" });
  });

  it("rejects a disallowed source URL scheme", async () => {
    const userId = await insertUser("bad-url@example.com");

    const result = await createApplication(userId, {
      company: "Acme",
      role: "Engineer",
      sourceUrl: "javascript:alert(1)",
    });
    expect(result).toEqual({ success: false, reason: "invalid_source_url" });
  });

  it("rejects a job description over 15000 characters", async () => {
    const userId = await insertUser("long-jd@example.com");

    const result = await createApplication(userId, {
      company: "Acme",
      role: "Engineer",
      jobDescription: "x".repeat(15001),
    });
    expect(result).toEqual({ success: false, reason: "job_description_too_long" });
  });
});
