import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/reminders (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let migrate: typeof import("../../../scripts/migrate.ts");
  let pool: typeof import("../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../scripts/migrate.ts");
    ({ pool } = await import("../../../lib/db.ts"));
    ({ GET: GET_ } = await import("./route.ts"));

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

  async function insertApplication(userId: string, deletedAt: Date | null = null): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, date_applied, interview_at, deleted_at)
       VALUES ($1, 'Acme', 'Engineer', '2026-09-01', $2, $3) RETURNING id`,
      [userId, new Date("2026-09-08T09:00:00Z"), deletedAt],
    );
    return result.rows[0].id;
  }

  async function insertReminder(params: {
    userId: string;
    applicationId: string;
    dueAt: Date;
    status?: string;
    type?: string;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [params.userId, params.applicationId, params.type ?? "application_followup", params.dueAt, params.status ?? "pending"],
    );
    return result.rows[0].id;
  }

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/reminders", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("returns 401 without a session", async () => {
    const response = await GET_(getRequest(null));
    expect(response.status).toBe(401);
  });

  it("returns an empty queue for a user with no reminders", async () => {
    const userId = await insertUser("empty@example.com");

    const response = await GET_(getRequest(userId));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dueNow: [], upcoming: [] });
  });

  it("places a past-due reminder under dueNow", async () => {
    const userId = await insertUser("due-now@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({
      userId,
      applicationId,
      dueAt: new Date(Date.now() - 60_000),
    });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.dueNow).toHaveLength(1);
    expect(body.dueNow[0].id).toBe(reminderId);
    expect(body.upcoming).toHaveLength(0);
  });

  it("places a future reminder under upcoming", async () => {
    const userId = await insertUser("upcoming@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({
      userId,
      applicationId,
      dueAt: new Date(Date.now() + 60_000),
    });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.upcoming).toHaveLength(1);
    expect(body.upcoming[0].id).toBe(reminderId);
    expect(body.dueNow).toHaveLength(0);
  });

  it("excludes a reminder belonging to another user", async () => {
    const ownerId = await insertUser("owner@example.com");
    const otherId = await insertUser("other@example.com");
    const applicationId = await insertApplication(ownerId);
    await insertReminder({ userId: ownerId, applicationId, dueAt: new Date(Date.now() - 60_000) });

    const response = await GET_(getRequest(otherId));
    const body = await response.json();

    expect(body.dueNow).toHaveLength(0);
    expect(body.upcoming).toHaveLength(0);
  });

  it("excludes a non-pending reminder", async () => {
    const userId = await insertUser("snoozed@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({
      userId,
      applicationId,
      dueAt: new Date(Date.now() - 60_000),
      status: "snoozed",
    });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.dueNow).toHaveLength(0);
    expect(body.upcoming).toHaveLength(0);
  });

  it("excludes a reminder whose application is soft-deleted", async () => {
    const userId = await insertUser("deleted-app@example.com");
    const applicationId = await insertApplication(userId, new Date());
    await insertReminder({ userId, applicationId, dueAt: new Date(Date.now() - 60_000) });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.dueNow).toHaveLength(0);
    expect(body.upcoming).toHaveLength(0);
  });

  it("returns dateApplied and interviewAt on each row", async () => {
    const userId = await insertUser("fields@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId, dueAt: new Date(Date.now() - 60_000) });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.dueNow[0].dateApplied).toBe("2026-09-01");
    expect(body.dueNow[0].interviewAt).toBe("2026-09-08T09:00:00.000Z");
    expect(body.dueNow[0].company).toBe("Acme");
    expect(body.dueNow[0].role).toBe("Engineer");
  });

  it("sorts each section by due_at ascending", async () => {
    const userId = await insertUser("sorted@example.com");
    const applicationId = await insertApplication(userId);
    const later = await insertReminder({
      userId,
      applicationId,
      dueAt: new Date(Date.now() - 60_000),
      type: "application_followup",
    });
    const earlier = await insertReminder({
      userId,
      applicationId,
      dueAt: new Date(Date.now() - 120_000),
      type: "post_interview",
    });

    const response = await GET_(getRequest(userId));
    const body = await response.json();

    expect(body.dueNow.map((r: { id: string }) => r.id)).toEqual([earlier, later]);
  });
});
