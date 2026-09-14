import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/account/export (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
    ({ GET: GET_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("TRUNCATE users CASCADE");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone, password_hash) VALUES ($1, $2, 'some-hash') RETURNING id",
      [email, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  async function insertApplication(
    userId: string,
    params: { company: string; deletedAt?: Date },
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, deleted_at) VALUES ($1, $2, 'Engineer', $3) RETURNING id`,
      [userId, params.company, params.deletedAt ?? null],
    );
    return result.rows[0].id;
  }

  function request(userId: string | null): Request {
    return new Request("http://localhost:3000/api/account/export", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("returns 401 without a session", async () => {
    const response = await GET_(request(null));
    expect(response.status).toBe(401);
  });

  it("sets Content-Disposition so a plain link downloads the file", async () => {
    const userId = await insertUser("headers@example.com");

    const response = await GET_(request(userId));

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="trackr-data-export.json"',
    );
  });

  it("never includes password_hash anywhere in the payload", async () => {
    const userId = await insertUser("no-hash-leak@example.com");

    const response = await GET_(request(userId));
    const text = await response.text();

    expect(text).not.toContain("some-hash");
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("passwordHash");
  });

  it("includes the account, profile, employment history, subscription, and applications with their timeline, reminders, and documents", async () => {
    const userId = await insertUser("full-export@example.com");
    await pool.query(
      `INSERT INTO profiles (user_id, full_name, target_role, skills) VALUES ($1, 'Aakriti Kapoor', 'Engineer', '{react}')`,
      [userId],
    );
    await pool.query(
      `INSERT INTO employment_history (user_id, employer, title, start_date) VALUES ($1, 'Razorpay', 'SWE', '2022-01-01')`,
      [userId],
    );
    await pool.query(`INSERT INTO subscriptions (user_id, tier) VALUES ($1, 'pro')`, [userId]);
    const applicationId = await insertApplication(userId, { company: "Zeta" });
    await pool.query(
      `INSERT INTO application_events (application_id, user_id, type, description) VALUES ($1, $2, 'created', 'Application created')`,
      [applicationId, userId],
    );
    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at, draft_content) VALUES ($1, $2, 'application_followup', now(), 'Hi there')`,
      [userId, applicationId],
    );
    await pool.query(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model) VALUES ($1, $2, 'cover_letter', 'Dear hiring manager...', 'gemini', 'gemini-2.5-flash')`,
      [applicationId, userId],
    );

    const response = await GET_(request(userId));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.account).toEqual({ email: "full-export@example.com", timezone: "Asia/Kolkata", createdAt: expect.any(String) });
    expect(data.profile.fullName).toBe("Aakriti Kapoor");
    expect(data.employmentHistory).toEqual([
      { employer: "Razorpay", title: "SWE", startDate: "2022-01-01", endDate: null },
    ]);
    expect(data.subscription.tier).toBe("pro");
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0].company).toBe("Zeta");
    expect(data.applications[0].events).toHaveLength(1);
    expect(data.applications[0].events[0].description).toBe("Application created");
    expect(data.applications[0].reminders).toEqual([
      expect.objectContaining({ draftContent: "Hi there" }),
    ]);
    expect(data.applications[0].documents).toEqual([
      expect.objectContaining({ content: "Dear hiring manager..." }),
    ]);
  });

  it("excludes a soft-deleted application and everything under it", async () => {
    const userId = await insertUser("soft-deleted@example.com");
    const keptId = await insertApplication(userId, { company: "Kept Co" });
    const deletedId = await insertApplication(userId, { company: "Deleted Co", deletedAt: new Date() });

    await pool.query(
      `INSERT INTO application_events (application_id, user_id, type, description) VALUES ($1, $2, 'created', 'On the deleted one')`,
      [deletedId, userId],
    );
    await pool.query(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model) VALUES ($1, $2, 'resume', 'should not export', 'gemini', 'gemini-2.5-flash')`,
      [deletedId, userId],
    );

    const response = await GET_(request(userId));
    const data = await response.json();

    const companies = data.applications.map((application: { company: string }) => application.company);
    expect(companies).toEqual(["Kept Co"]);

    const text = JSON.stringify(data);
    expect(text).not.toContain("should not export");
    expect(text).not.toContain("On the deleted one");
    expect(keptId).toBeTruthy();
  });

  it("never includes another user's data", async () => {
    const userId = await insertUser("owner@example.com");
    const otherUserId = await insertUser("other@example.com");
    await insertApplication(otherUserId, { company: "Not Mine" });
    await insertApplication(userId, { company: "Mine" });

    const response = await GET_(request(userId));
    const data = await response.json();

    const companies = data.applications.map((application: { company: string }) => application.company);
    expect(companies).toEqual(["Mine"]);
  });
});
