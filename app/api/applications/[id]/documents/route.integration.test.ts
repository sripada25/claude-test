import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/applications/:id/documents (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
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

  async function insertApplication(userId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertDocument(userId: string, applicationId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'content', 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationId, userId],
    );
    return result.rows[0].id;
  }

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/applications/placeholder/documents", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function callRoute(request: Request, applicationId: string) {
    return GET_(request, { params: Promise.resolve({ id: applicationId }) });
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

    const response = await callRoute(getRequest(attackerId), applicationId);

    expect(response.status).toBe(404);
  });

  it("returns 200 with an empty array for an application with no documents", async () => {
    const userId = await insertUser("empty@example.com");
    const applicationId = await insertApplication(userId);

    const response = await callRoute(getRequest(userId), applicationId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("returns 200 with documents newest-first", async () => {
    const userId = await insertUser("ordered@example.com");
    const applicationId = await insertApplication(userId);
    const olderId = await insertDocument(userId, applicationId);
    await pool.query("UPDATE documents SET created_at = now() - interval '1 hour' WHERE id = $1", [olderId]);
    const newerId = await insertDocument(userId, applicationId);

    const response = await callRoute(getRequest(userId), applicationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.map((doc: { id: string }) => doc.id)).toEqual([newerId, olderId]);
  });
});
