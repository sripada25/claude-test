import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/documents/:id (real Postgres)", () => {
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

  async function insertDocument(userId: string): Promise<string> {
    const applicationResult = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    const documentResult = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'Original content', 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationResult.rows[0].id, userId],
    );
    return documentResult.rows[0].id;
  }

  function patchRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/documents/placeholder", {
      method: "PATCH",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  function callRoute(request: Request, documentId: string) {
    return PATCH_(request, { params: Promise.resolve({ id: documentId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(patchRequest(null, { content: "x" }), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing content field", async () => {
    const userId = await insertUser("missing-content@example.com");
    const documentId = await insertDocument(userId);

    const response = await callRoute(patchRequest(userId, {}), documentId);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid_body" });
  });

  it("returns 400 for a non-string content field", async () => {
    const userId = await insertUser("non-string-content@example.com");
    const documentId = await insertDocument(userId);

    const response = await callRoute(patchRequest(userId, { content: 42 }), documentId);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid_body" });
  });

  it("returns 400 for empty content", async () => {
    const userId = await insertUser("empty-content@example.com");
    const documentId = await insertDocument(userId);

    const response = await callRoute(patchRequest(userId, { content: "   " }), documentId);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "empty_content" });
  });

  it("returns 404 for a document belonging to a different user", async () => {
    const userId = await insertUser("victim@example.com");
    const attackerId = await insertUser("attacker@example.com");
    const documentId = await insertDocument(userId);

    const response = await callRoute(patchRequest(attackerId, { content: "hijacked" }), documentId);

    expect(response.status).toBe(404);
  });

  it("returns 200 with the updated document on success", async () => {
    const userId = await insertUser("success@example.com");
    const documentId = await insertDocument(userId);

    const response = await callRoute(patchRequest(userId, { content: "Edited content" }), documentId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: documentId, type: "cover_letter", content: "Edited content" });
  });
});
