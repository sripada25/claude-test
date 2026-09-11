import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/reminders/:id PATCH (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let PATCH_: typeof import("./route.ts")["PATCH"];
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
    ({ PATCH: PATCH_ } = await import("./route.ts"));

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

  function patchRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/reminders/any-id", {
      method: "PATCH",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function callRoute(request: Request, reminderId: string) {
    return PATCH_(request, { params: Promise.resolve({ id: reminderId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(patchRequest(null, { action: "dismiss" }), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing action", async () => {
    const userId = await insertUser("bad-body@example.com");
    const response = await callRoute(patchRequest(userId, {}), "any-id");
    expect(response.status).toBe(400);
  });

  it("returns 400 for a snooze with a past until", async () => {
    const userId = await insertUser("past-until@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(
      patchRequest(userId, { action: "snooze", until: new Date(Date.now() - 60_000).toISOString() }),
      reminderId,
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for a snooze with an unparseable until", async () => {
    const userId = await insertUser("bad-until@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(patchRequest(userId, { action: "snooze", until: "not-a-date" }), reminderId);

    expect(response.status).toBe(400);
  });

  it("returns a generic 404 for a nonexistent reminder", async () => {
    const userId = await insertUser("no-reminder@example.com");

    const response = await callRoute(
      patchRequest(userId, { action: "dismiss" }),
      "00000000-0000-0000-0000-000000000000",
    );

    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for a reminder belonging to another user", async () => {
    const ownerId = await insertUser("owner@example.com");
    const otherId = await insertUser("other@example.com");
    const applicationId = await insertApplication(ownerId);
    const reminderId = await insertReminder({ userId: ownerId, applicationId });

    const response = await callRoute(patchRequest(otherId, { action: "dismiss" }), reminderId);

    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for an already-sent reminder", async () => {
    const userId = await insertUser("already-sent@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, status: "sent" });

    const response = await callRoute(patchRequest(userId, { action: "dismiss" }), reminderId);

    expect(response.status).toBe(404);
  });

  it("dismisses a pending reminder, setting status and dismissed_at only", async () => {
    const userId = await insertUser("dismiss-me@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(patchRequest(userId, { action: "dismiss" }), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("dismissed");
    expect(body.dismissedAt).not.toBeNull();
    expect(body.snoozedUntil).toBeNull();

    const application = await pool.query<{ follow_up_snoozed_until: Date | null }>(
      "SELECT follow_up_snoozed_until FROM applications WHERE id = $1",
      [applicationId],
    );
    expect(application.rows[0].follow_up_snoozed_until).toBeNull();
  });

  it("snoozes a pending reminder, writing both reminders and applications", async () => {
    const userId = await insertUser("snooze-me@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const response = await callRoute(patchRequest(userId, { action: "snooze", until: until.toISOString() }), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("snoozed");
    expect(new Date(body.snoozedUntil).getTime()).toBe(until.getTime());
    expect(body.dismissedAt).toBeNull();

    const reminder = await pool.query<{ status: string; snoozed_until: Date }>(
      "SELECT status, snoozed_until FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(reminder.rows[0].status).toBe("snoozed");
    expect(reminder.rows[0].snoozed_until.getTime()).toBe(until.getTime());

    const application = await pool.query<{ follow_up_snoozed_until: Date }>(
      "SELECT follow_up_snoozed_until FROM applications WHERE id = $1",
      [applicationId],
    );
    expect(application.rows[0].follow_up_snoozed_until.getTime()).toBe(until.getTime());
  });

  it("allows re-snoozing an already-snoozed reminder to a new length", async () => {
    const userId = await insertUser("re-snooze@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, status: "snoozed" });
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const response = await callRoute(patchRequest(userId, { action: "snooze", until: until.toISOString() }), reminderId);

    expect(response.status).toBe(200);
    const reminder = await pool.query<{ snoozed_until: Date }>("SELECT snoozed_until FROM reminders WHERE id = $1", [
      reminderId,
    ]);
    expect(reminder.rows[0].snoozed_until.getTime()).toBe(until.getTime());
  });
});
