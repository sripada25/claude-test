import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("application service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let createApplication: typeof import("./application.ts")["createApplication"];
  let listApplications: typeof import("./application.ts")["listApplications"];
  let getApplication: typeof import("./application.ts")["getApplication"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ createApplication, listApplications, getApplication } = await import("./application.ts"));

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

  async function insertRawApplication(
    userId: string,
    overrides: {
      company?: string;
      role?: string;
      status?: string;
      source?: string | null;
      dateApplied?: string | null;
      lastActivityAt?: Date;
      deletedAt?: Date | null;
    } = {},
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications
         (user_id, company, role, status, source, date_applied, last_activity_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        userId,
        overrides.company ?? "Acme",
        overrides.role ?? "Engineer",
        overrides.status ?? "saved",
        overrides.source ?? null,
        overrides.dateApplied ?? null,
        overrides.lastActivityAt ?? new Date(),
        overrides.deletedAt ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async function insertEvent(applicationId: string, userId: string, type: string): Promise<void> {
    await pool.query(
      `INSERT INTO application_events (application_id, user_id, type, description)
       VALUES ($1, $2, $3, 'test event')`,
      [applicationId, userId, type],
    );
  }

  it("writes exactly one created event when an application is created", async () => {
    const userId = await insertUser("created-event@example.com");

    const result = await createApplication(userId, { company: "Acme", role: "Engineer" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const events = await pool.query<{ type: string; description: string }>(
      "SELECT type, description FROM application_events WHERE application_id = $1",
      [result.application.id],
    );
    expect(events.rows).toEqual([{ type: "created", description: "Application created" }]);
  });

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

  it("returns only the calling user's applications", async () => {
    const userA = await insertUser("user-a@example.com");
    const userB = await insertUser("user-b@example.com");
    await insertRawApplication(userA, { company: "A Co" });
    await insertRawApplication(userB, { company: "B Co" });

    const results = await listApplications(userA, {});

    expect(results).toHaveLength(1);
    expect(results[0].company).toBe("A Co");
  });

  it("never returns a soft-deleted application", async () => {
    const userId = await insertUser("soft-delete@example.com");
    await insertRawApplication(userId, { company: "Visible Co" });
    await insertRawApplication(userId, { company: "Deleted Co", deletedAt: new Date() });

    const results = await listApplications(userId, {});

    expect(results.map((r) => r.company)).toEqual(["Visible Co"]);
  });

  it("q matches company or role, case-insensitively", async () => {
    const userId = await insertUser("search@example.com");
    await insertRawApplication(userId, { company: "Umbrella Corp", role: "Scientist" });
    await insertRawApplication(userId, { company: "Acme", role: "Umbrella Salesman" });
    await insertRawApplication(userId, { company: "Initech", role: "Engineer" });

    const results = await listApplications(userId, { q: "UMBRELLA" });

    expect(results.map((r) => r.company).sort()).toEqual(["Acme", "Umbrella Corp"]);
  });

  it("filters by status, ignoring unrecognized values", async () => {
    const userId = await insertUser("status-filter@example.com");
    await insertRawApplication(userId, { company: "Saved Co", status: "saved" });
    await insertRawApplication(userId, { company: "Applied Co", status: "applied" });
    await insertRawApplication(userId, { company: "Offer Co", status: "offer" });

    const results = await listApplications(userId, { status: ["applied", "offer", "bogus"] });

    expect(results.map((r) => r.company).sort()).toEqual(["Applied Co", "Offer Co"]);
  });

  it("filters by source, ignoring unrecognized values", async () => {
    const userId = await insertUser("source-filter@example.com");
    await insertRawApplication(userId, { company: "LinkedIn Co", source: "linkedin" });
    await insertRawApplication(userId, { company: "Referral Co", source: "referral" });
    await insertRawApplication(userId, { company: "No Source Co", source: null });

    const results = await listApplications(userId, { source: ["linkedin", "bogus"] });

    expect(results.map((r) => r.company)).toEqual(["LinkedIn Co"]);
  });

  it("sorts by recent (default) and oldest_activity", async () => {
    const userId = await insertUser("sort-activity@example.com");
    const now = Date.now();
    await insertRawApplication(userId, {
      company: "Older",
      lastActivityAt: new Date(now - 2 * 86_400_000),
    });
    await insertRawApplication(userId, {
      company: "Newer",
      lastActivityAt: new Date(now - 1 * 86_400_000),
    });

    const recent = await listApplications(userId, {});
    expect(recent.map((r) => r.company)).toEqual(["Newer", "Older"]);

    const oldest = await listApplications(userId, { sort: "oldest_activity" });
    expect(oldest.map((r) => r.company)).toEqual(["Older", "Newer"]);
  });

  it("sorts by company_az", async () => {
    const userId = await insertUser("sort-company@example.com");
    await insertRawApplication(userId, { company: "Zebra Inc" });
    await insertRawApplication(userId, { company: "Acme" });

    const results = await listApplications(userId, { sort: "company_az" });

    expect(results.map((r) => r.company)).toEqual(["Acme", "Zebra Inc"]);
  });

  it("falls back to recent for an unrecognized sort value", async () => {
    const userId = await insertUser("sort-fallback@example.com");
    const now = Date.now();
    await insertRawApplication(userId, {
      company: "Older",
      lastActivityAt: new Date(now - 2 * 86_400_000),
    });
    await insertRawApplication(userId, {
      company: "Newer",
      lastActivityAt: new Date(now - 1 * 86_400_000),
    });

    const results = await listApplications(userId, { sort: "bogus" });

    expect(results.map((r) => r.company)).toEqual(["Newer", "Older"]);
  });

  it("computes followUpDue correctly", async () => {
    const userId = await insertUser("follow-up@example.com");
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const oneDayAgo = new Date(Date.now() - 1 * 86_400_000).toISOString().slice(0, 10);

    const dueId = await insertRawApplication(userId, {
      company: "Due Co",
      status: "applied",
      dateApplied: tenDaysAgo,
    });
    await insertRawApplication(userId, {
      company: "Too Recent Co",
      status: "applied",
      dateApplied: oneDayAgo,
    });
    const sentId = await insertRawApplication(userId, {
      company: "Already Sent Co",
      status: "applied",
      dateApplied: tenDaysAgo,
    });
    await insertEvent(sentId, userId, "follow_up_sent");
    await insertRawApplication(userId, {
      company: "Wrong Status Co",
      status: "saved",
      dateApplied: tenDaysAgo,
    });

    const results = await listApplications(userId, {});
    const byCompany = Object.fromEntries(results.map((r) => [r.company, r.followUpDue]));

    expect(byCompany["Due Co"]).toBe(true);
    expect(byCompany["Too Recent Co"]).toBe(false);
    expect(byCompany["Already Sent Co"]).toBe(false);
    expect(byCompany["Wrong Status Co"]).toBe(false);
    expect(dueId).toBeTruthy();
  });

  it("returns the application when owned and not deleted", async () => {
    const userId = await insertUser("get-owned@example.com");
    const id = await insertRawApplication(userId, { company: "Owned Co" });

    const result = await getApplication(userId, id);

    expect(result?.company).toBe("Owned Co");
  });

  it("returns null for another user's application", async () => {
    const owner = await insertUser("get-owner@example.com");
    const other = await insertUser("get-other@example.com");
    const id = await insertRawApplication(owner, { company: "Not Yours Co" });

    expect(await getApplication(other, id)).toBeNull();
  });

  it("returns null for a soft-deleted application, even for its owner", async () => {
    const userId = await insertUser("get-deleted@example.com");
    const id = await insertRawApplication(userId, { company: "Deleted Co", deletedAt: new Date() });

    expect(await getApplication(userId, id)).toBeNull();
  });

  it("returns null for a nonexistent id", async () => {
    const userId = await insertUser("get-missing@example.com");

    expect(await getApplication(userId, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a malformed id, without throwing", async () => {
    const userId = await insertUser("get-malformed@example.com");

    await expect(getApplication(userId, "not-a-uuid")).resolves.toBeNull();
  });
});
