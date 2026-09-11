import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const draftFollowUpMock = vi.fn();
const getAIProviderMetadataMock = vi.fn();

vi.mock("../../../../../lib/ai/provider.ts", () => ({
  getAIProvider: () => ({ draftFollowUp: draftFollowUpMock }),
  getAIProviderMetadata: () => getAIProviderMetadataMock(),
}));

describe("/api/reminders/:id/draft (real Postgres)", () => {
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

  beforeEach(() => {
    getAIProviderMetadataMock.mockReturnValue({ provider: "gemini", model: "gemini-flash-latest" });
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users");
    draftFollowUpMock.mockReset();
    getAIProviderMetadataMock.mockReset();
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
      `INSERT INTO applications (user_id, company, role, date_applied) VALUES ($1, 'Acme', 'Engineer', '2026-09-01') RETURNING id`,
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertReminder(params: {
    userId: string;
    applicationId: string;
    type?: string;
    draftContent?: string | null;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, draft_content)
       VALUES ($1, $2, $3, now(), $4) RETURNING id`,
      [params.userId, params.applicationId, params.type ?? "application_followup", params.draftContent ?? null],
    );
    return result.rows[0].id;
  }

  function postRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/reminders/any-id/draft", {
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
    expect(draftFollowUpMock).not.toHaveBeenCalled();
  });

  it("returns a generic 404 for a reminder belonging to another user", async () => {
    const ownerId = await insertUser("owner@example.com");
    const otherId = await insertUser("other@example.com");
    const applicationId = await insertApplication(ownerId);
    const reminderId = await insertReminder({ userId: ownerId, applicationId });

    const response = await callRoute(postRequest(otherId), reminderId);

    expect(response.status).toBe(404);
    expect(draftFollowUpMock).not.toHaveBeenCalled();
  });

  it("returns an existing draft without calling the AI provider again", async () => {
    const userId = await insertUser("existing-draft@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, draftContent: "Already drafted." });

    const response = await callRoute(postRequest(userId), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ draftContent: "Already drafted." });
    expect(draftFollowUpMock).not.toHaveBeenCalled();

    const usage = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(usage.rows).toHaveLength(0);
  });

  it("generates and persists a new draft when none exists, logging one ai_usage row", async () => {
    const userId = await insertUser("new-draft@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, type: "application_followup" });
    draftFollowUpMock.mockResolvedValue({ success: true, data: "Following up on my application." });

    const response = await callRoute(postRequest(userId), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ draftContent: "Following up on my application." });

    expect(draftFollowUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application_followup",
        companyName: "Acme",
        roleTitle: "Engineer",
      }),
    );

    const stored = await pool.query<{ draft_content: string }>("SELECT draft_content FROM reminders WHERE id = $1", [
      reminderId,
    ]);
    expect(stored.rows[0].draft_content).toBe("Following up on my application.");

    const usage = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({
      operation: "draft_follow_up",
      status: "succeeded",
      tokens_in: null,
      tokens_out: null,
      job_id: null,
    });
  });

  it("returns a generic error on an AI failure, still logging a failed ai_usage row", async () => {
    const userId = await insertUser("ai-failure@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });
    draftFollowUpMock.mockResolvedValue({
      success: false,
      error: { errorClass: "unavailable", message: "down" },
    });

    const response = await callRoute(postRequest(userId), reminderId);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).not.toHaveProperty("errorClass");
    expect(JSON.stringify(body)).not.toContain("unavailable");

    const usage = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({ operation: "draft_follow_up", status: "failed", error_class: "unavailable" });

    const stored = await pool.query<{ draft_content: string | null }>(
      "SELECT draft_content FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(stored.rows[0].draft_content).toBeNull();
  });

  it("never touches generation_quota", async () => {
    const userId = await insertUser("no-quota@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });
    draftFollowUpMock.mockResolvedValue({ success: true, data: "Following up." });

    await callRoute(postRequest(userId), reminderId);

    const quota = await pool.query("SELECT * FROM generation_quota WHERE user_id = $1", [userId]);
    expect(quota.rows).toHaveLength(0);
  });
});
