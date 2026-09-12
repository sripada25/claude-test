import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const structureCallNoteMock = vi.fn();
const getAIProviderMetadataMock = vi.fn();

vi.mock("../../../../../../lib/ai/provider.ts", () => ({
  getAIProvider: () => ({ structureCallNote: structureCallNoteMock }),
  getAIProviderMetadata: () => getAIProviderMetadataMock(),
}));

describe("/api/applications/:id/call-notes/structure (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let POST_: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../../lib/db.ts"));
    ({ POST: POST_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  beforeEach(() => {
    getAIProviderMetadataMock.mockReturnValue({ provider: "gemini", model: "gemini-flash-latest" });
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users");
    structureCallNoteMock.mockReset();
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
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  const ANSWERS = {
    question1Answer: "Priya, from talent acquisition",
    question2Answer: "Budget is 28-32L, wants to move fast",
    question3Answer: "They send a take-home by Thursday",
  };

  function postRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/applications/placeholder/call-notes/structure", {
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

  it("returns the structured note on success and never consumes generation_quota", async () => {
    const userId = await insertUser("structure-ok@example.com");
    const applicationId = await insertApplication(userId);
    structureCallNoteMock.mockResolvedValue({
      success: true,
      data: {
        summary: "Call with Priya about the role",
        salaryMentioned: "28-32L",
        contactName: "Priya",
        contactRole: "Talent Acquisition",
        nextStep: "Take-home assignment",
        followUpDate: "2026-08-28",
      },
    });

    const response = await callRoute(postRequest(userId, ANSWERS), applicationId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contactName).toBe("Priya");
    expect(body.followUpDate).toBe("2026-08-28");

    const usage = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({ operation: "structure_call_note", status: "succeeded" });

    const quota = await pool.query("SELECT * FROM generation_quota WHERE user_id = $1", [userId]);
    expect(quota.rows).toHaveLength(0);
  });

  it("returns a generic error and logs a failed ai_usage row on AI failure", async () => {
    const userId = await insertUser("structure-fail@example.com");
    const applicationId = await insertApplication(userId);
    structureCallNoteMock.mockResolvedValue({
      success: false,
      error: { errorClass: "unavailable", message: "down" },
    });

    const response = await callRoute(postRequest(userId, ANSWERS), applicationId);

    expect(response.status).toBe(502);
    const usage = await pool.query("SELECT * FROM ai_usage WHERE user_id = $1", [userId]);
    expect(usage.rows[0]).toMatchObject({ operation: "structure_call_note", status: "failed" });

    const events = await pool.query("SELECT * FROM application_events WHERE application_id = $1", [applicationId]);
    expect(events.rows).toHaveLength(0);
  });
});
