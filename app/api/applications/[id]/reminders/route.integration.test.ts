import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/applications/:id/reminders (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let POST_: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
    ({ GET: GET_, POST: POST_ } = await import("./route.ts"));

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

  async function insertReminder(params: {
    userId: string;
    applicationId: string;
    type?: string;
    status?: string;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status)
       VALUES ($1, $2, $3, now(), $4) RETURNING id`,
      [params.userId, params.applicationId, params.type ?? "application_followup", params.status ?? "pending"],
    );
    return result.rows[0].id;
  }

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/applications/placeholder/reminders", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function callRoute(request: Request, applicationId: string) {
    return GET_(request, { params: Promise.resolve({ id: applicationId }) });
  }

  function futureDate(): string {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  function postRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/applications/placeholder/reminders", {
      method: "POST",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function callPostRoute(request: Request, applicationId: string) {
    return POST_(request, { params: Promise.resolve({ id: applicationId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(getRequest(null), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent application", async () => {
    const userId = await insertUser("missing@example.com");
    const missingId = "00000000-0000-0000-0000-000000000000";

    const response = await callRoute(getRequest(userId), missingId);

    expect(response.status).toBe(404);
  });

  it("returns 404 for an application belonging to a different user", async () => {
    const userId = await insertUser("victim@example.com");
    const attackerId = await insertUser("attacker@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId });

    const response = await callRoute(getRequest(attackerId), applicationId);

    expect(response.status).toBe(404);
  });

  it("returns an empty list for an application with no reminders", async () => {
    const userId = await insertUser("no-reminders@example.com");
    const applicationId = await insertApplication(userId);

    const response = await callRoute(getRequest(userId), applicationId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns every reminder for the application regardless of status", async () => {
    const userId = await insertUser("mixed-status@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId, type: "application_followup", status: "sent" });
    await insertReminder({ userId, applicationId, type: "post_interview", status: "pending" });

    const response = await callRoute(getRequest(userId), applicationId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body.map((r: { status: string }) => r.status).sort()).toEqual(["pending", "sent"]);
  });

  it("excludes a reminder belonging to a different application", async () => {
    const userId = await insertUser("scoped@example.com");
    const applicationId = await insertApplication(userId);
    const otherApplicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId: otherApplicationId });

    const response = await callRoute(getRequest(userId), applicationId);
    const body = await response.json();

    expect(body).toEqual([]);
  });

  describe("POST", () => {
    it("returns 401 without a session", async () => {
      const response = await callPostRoute(postRequest(null, { dueAt: futureDate() }), "any-id");
      expect(response.status).toBe(401);
    });

    it("returns 400 for a missing dueAt", async () => {
      const userId = await insertUser("missing-due-at@example.com");
      const response = await callPostRoute(postRequest(userId, {}), "any-id");
      expect(response.status).toBe(400);
    });

    it("returns 400 for a past dueAt", async () => {
      const userId = await insertUser("past-due-at@example.com");
      const applicationId = await insertApplication(userId);

      const response = await callPostRoute(
        postRequest(userId, { dueAt: new Date(Date.now() - 60_000).toISOString() }),
        applicationId,
      );

      expect(response.status).toBe(400);
    });

    it("returns a generic 404 for a nonexistent application", async () => {
      const userId = await insertUser("no-app@example.com");

      const response = await callPostRoute(
        postRequest(userId, { dueAt: futureDate() }),
        "00000000-0000-0000-0000-000000000000",
      );

      expect(response.status).toBe(404);
    });

    it("returns a generic 404 for another user's application", async () => {
      const ownerId = await insertUser("owner-post@example.com");
      const attackerId = await insertUser("attacker-post@example.com");
      const applicationId = await insertApplication(ownerId);

      const response = await callPostRoute(postRequest(attackerId, { dueAt: futureDate() }), applicationId);

      expect(response.status).toBe(404);
    });

    it("creates a new pending application_followup reminder", async () => {
      const userId = await insertUser("create-new@example.com");
      const applicationId = await insertApplication(userId);
      const dueAt = futureDate();

      const response = await callPostRoute(postRequest(userId, { dueAt }), applicationId);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("pending");
      expect(new Date(body.dueAt).getTime()).toBe(new Date(dueAt).getTime());

      const stored = await pool.query<{ type: string; status: string }>(
        "SELECT type, status FROM reminders WHERE id = $1",
        [body.id],
      );
      expect(stored.rows[0]).toMatchObject({ type: "application_followup", status: "pending" });
    });

    it("returns 409 when an active application_followup reminder already exists", async () => {
      const userId = await insertUser("already-active@example.com");
      const applicationId = await insertApplication(userId);
      await insertReminder({ userId, applicationId, status: "pending" });

      const response = await callPostRoute(postRequest(userId, { dueAt: futureDate() }), applicationId);

      expect(response.status).toBe(409);
    });

    it("returns 409 when an active snoozed reminder already exists", async () => {
      const userId = await insertUser("already-snoozed@example.com");
      const applicationId = await insertApplication(userId);
      await insertReminder({ userId, applicationId, status: "snoozed" });

      const response = await callPostRoute(postRequest(userId, { dueAt: futureDate() }), applicationId);

      expect(response.status).toBe(409);
    });

    it("re-arms a resolved (sent) reminder with the new due date", async () => {
      const userId = await insertUser("re-arm-sent@example.com");
      const applicationId = await insertApplication(userId);
      const oldReminderId = await insertReminder({ userId, applicationId, status: "sent" });
      const dueAt = futureDate();

      const response = await callPostRoute(postRequest(userId, { dueAt }), applicationId);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(oldReminderId);
      expect(body.status).toBe("pending");

      const stored = await pool.query<{
        status: string;
        sent_at: Date | null;
        draft_content: string | null;
      }>("SELECT status, sent_at, draft_content FROM reminders WHERE id = $1", [oldReminderId]);
      expect(stored.rows[0]).toMatchObject({ status: "pending", sent_at: null, draft_content: null });
    });

    it("re-arms a resolved (dismissed) reminder with the new due date", async () => {
      const userId = await insertUser("re-arm-dismissed@example.com");
      const applicationId = await insertApplication(userId);
      const oldReminderId = await insertReminder({ userId, applicationId, status: "dismissed" });

      const response = await callPostRoute(postRequest(userId, { dueAt: futureDate() }), applicationId);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(oldReminderId);
      expect(body.status).toBe("pending");
    });

    it("does not touch a different application's reminder", async () => {
      const userId = await insertUser("unaffected@example.com");
      const applicationId = await insertApplication(userId);
      const otherApplicationId = await insertApplication(userId);
      const otherReminderId = await insertReminder({ userId, applicationId: otherApplicationId, status: "sent" });

      await callPostRoute(postRequest(userId, { dueAt: futureDate() }), applicationId);

      const stored = await pool.query<{ status: string }>("SELECT status FROM reminders WHERE id = $1", [
        otherReminderId,
      ]);
      expect(stored.rows[0].status).toBe("sent");
    });
  });
});
