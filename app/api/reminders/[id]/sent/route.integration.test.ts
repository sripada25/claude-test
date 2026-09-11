import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/reminders/:id/sent (real Postgres)", () => {
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
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id`,
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertReminder(params: { userId: string; applicationId: string; status?: string }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status)
       VALUES ($1, $2, 'application_followup', now(), $3) RETURNING id`,
      [params.userId, params.applicationId, params.status ?? "pending"],
    );
    return result.rows[0].id;
  }

  function postRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/reminders/any-id/sent", {
      method: "POST",
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function callRoute(request: Request, reminderId: string) {
    return POST_(request, { params: Promise.resolve({ id: reminderId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(postRequest(null), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns a generic 404 for a nonexistent reminder", async () => {
    const userId = await insertUser("no-reminder@example.com");

    const response = await callRoute(postRequest(userId), "00000000-0000-0000-0000-000000000000");

    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for a reminder belonging to another user", async () => {
    const ownerId = await insertUser("owner@example.com");
    const otherId = await insertUser("other@example.com");
    const applicationId = await insertApplication(ownerId);
    const reminderId = await insertReminder({ userId: ownerId, applicationId });

    const response = await callRoute(postRequest(otherId), reminderId);

    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for an already-sent reminder", async () => {
    const userId = await insertUser("already-sent@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, status: "sent" });

    const response = await callRoute(postRequest(userId), reminderId);

    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for a dismissed reminder", async () => {
    const userId = await insertUser("dismissed@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, status: "dismissed" });

    const response = await callRoute(postRequest(userId), reminderId);

    expect(response.status).toBe(404);
  });

  it("marks a snoozed reminder as sent too", async () => {
    const userId = await insertUser("snoozed-sent@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, status: "snoozed" });

    const response = await callRoute(postRequest(userId), reminderId);

    expect(response.status).toBe(200);
  });

  it("marks a pending reminder sent, writing sent_at and one application_events row", async () => {
    const userId = await insertUser("mark-sent@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(postRequest(userId), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.sentAt).not.toBeNull();

    const reminder = await pool.query<{ status: string; sent_at: Date | null }>(
      "SELECT status, sent_at FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(reminder.rows[0].status).toBe("sent");
    expect(reminder.rows[0].sent_at).not.toBeNull();

    const events = await pool.query<{ type: string; description: string; application_id: string }>(
      "SELECT type, description, application_id FROM application_events WHERE application_id = $1",
      [applicationId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]).toMatchObject({
      type: "follow_up_sent",
      description: "Follow-up email sent",
      application_id: applicationId,
    });
  });

  it("never writes to applications.follow_up_snoozed_until", async () => {
    const userId = await insertUser("no-app-write@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    await callRoute(postRequest(userId), reminderId);

    const application = await pool.query<{ follow_up_snoozed_until: Date | null }>(
      "SELECT follow_up_snoozed_until FROM applications WHERE id = $1",
      [applicationId],
    );
    expect(application.rows[0].follow_up_snoozed_until).toBeNull();
  });
});
