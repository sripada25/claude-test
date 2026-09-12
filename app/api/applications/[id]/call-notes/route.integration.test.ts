import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/applications/:id/call-notes (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let POST_: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
    ({ POST: POST_ } = await import("./route.ts"));

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
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  const ANSWERS = {
    question1Answer: "Priya, from talent acquisition",
    question2Answer: "Budget is 28-32L, wants to move fast, take-home if interested",
    question3Answer: "They send a take-home by Thursday",
  };

  function futureDate(): string {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function postRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/applications/placeholder/call-notes", {
      method: "POST",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function callRoute(request: Request, applicationId: string) {
    return POST_(request, { params: Promise.resolve({ id: applicationId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(postRequest(null, ANSWERS), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing answer", async () => {
    const userId = await insertUser("missing-answer@example.com");
    const response = await callRoute(postRequest(userId, { question1Answer: "x" }), "any-id");
    expect(response.status).toBe(400);
  });

  it("returns a generic 404 for a nonexistent application", async () => {
    const userId = await insertUser("no-app@example.com");
    const response = await callRoute(postRequest(userId, ANSWERS), "00000000-0000-0000-0000-000000000000");
    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for another user's application", async () => {
    const ownerId = await insertUser("owner@example.com");
    const attackerId = await insertUser("attacker@example.com");
    const applicationId = await insertApplication(ownerId);

    const response = await callRoute(postRequest(attackerId, ANSWERS), applicationId);

    expect(response.status).toBe(404);
  });

  it("saves a plain note: writes one call_logged event and bumps last_activity_at, no reminder", async () => {
    const userId = await insertUser("plain-note@example.com");
    const applicationId = await insertApplication(userId);
    const before = await pool.query<{ last_activity_at: Date }>(
      "SELECT last_activity_at FROM applications WHERE id = $1",
      [applicationId],
    );

    const response = await callRoute(postRequest(userId, ANSWERS), applicationId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    const events = await pool.query<{ type: string; description: string }>(
      "SELECT type, description FROM application_events WHERE application_id = $1",
      [applicationId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].type).toBe("call_logged");
    expect(events.rows[0].description).toContain("Call logged");

    const after = await pool.query<{ last_activity_at: Date }>(
      "SELECT last_activity_at FROM applications WHERE id = $1",
      [applicationId],
    );
    expect(after.rows[0].last_activity_at.getTime()).toBeGreaterThan(before.rows[0].last_activity_at.getTime());

    const reminders = await pool.query("SELECT * FROM reminders WHERE application_id = $1", [applicationId]);
    expect(reminders.rows).toHaveLength(0);
  });

  it("saves an AI-structured note with a follow-up date and creates a real reminder", async () => {
    const userId = await insertUser("structured-with-date@example.com");
    const applicationId = await insertApplication(userId);
    const followUpDate = futureDate();

    const response = await callRoute(
      postRequest(userId, {
        ...ANSWERS,
        structured: {
          summary: "Call with Priya about the Engineer role",
          salaryMentioned: "28-32L",
          contactName: "Priya",
          contactRole: "Talent Acquisition",
          nextStep: "Take-home assignment",
          followUpDate,
        },
      }),
      applicationId,
    );

    expect(response.status).toBe(200);

    const events = await pool.query<{ description: string; metadata: { structured: { contactName: string } } }>(
      "SELECT description, metadata FROM application_events WHERE application_id = $1",
      [applicationId],
    );
    expect(events.rows[0].description).toBe("Call with Priya about the Engineer role");
    expect(events.rows[0].metadata.structured.contactName).toBe("Priya");

    const reminders = await pool.query<{ type: string; status: string; due_at: Date }>(
      "SELECT type, status, due_at FROM reminders WHERE application_id = $1",
      [applicationId],
    );
    expect(reminders.rows).toHaveLength(1);
    expect(reminders.rows[0]).toMatchObject({ type: "application_followup", status: "pending" });
  });

  it("saves an AI-structured note with no follow-up date and creates no reminder", async () => {
    const userId = await insertUser("structured-no-date@example.com");
    const applicationId = await insertApplication(userId);

    await callRoute(
      postRequest(userId, {
        ...ANSWERS,
        structured: {
          summary: "Quick check-in call",
          salaryMentioned: null,
          contactName: null,
          contactRole: null,
          nextStep: null,
          followUpDate: null,
        },
      }),
      applicationId,
    );

    const reminders = await pool.query("SELECT * FROM reminders WHERE application_id = $1", [applicationId]);
    expect(reminders.rows).toHaveLength(0);
  });

  it("does not fail the save when a reminder already exists and is active", async () => {
    const userId = await insertUser("existing-reminder@example.com");
    const applicationId = await insertApplication(userId);
    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status) VALUES ($1, $2, 'application_followup', now() + interval '3 days', 'pending')`,
      [userId, applicationId],
    );

    const response = await callRoute(
      postRequest(userId, { ...ANSWERS, structured: { summary: "s", salaryMentioned: null, contactName: null, contactRole: null, nextStep: null, followUpDate: futureDate() } }),
      applicationId,
    );

    expect(response.status).toBe(200);
    const reminders = await pool.query("SELECT * FROM reminders WHERE application_id = $1", [applicationId]);
    expect(reminders.rows).toHaveLength(1);
  });

  it("whitelists the structured field, ignoring unknown keys", async () => {
    const userId = await insertUser("whitelist@example.com");
    const applicationId = await insertApplication(userId);

    const response = await callRoute(
      postRequest(userId, {
        ...ANSWERS,
        structured: { summary: "s", extraField: "should not be stored", followUpDate: null },
      }),
      applicationId,
    );

    expect(response.status).toBe(200);
    const events = await pool.query<{ metadata: { structured: Record<string, unknown> } }>(
      "SELECT metadata FROM application_events WHERE application_id = $1",
      [applicationId],
    );
    expect(events.rows[0].metadata.structured).not.toHaveProperty("extraField");
  });
});
