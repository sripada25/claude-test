import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/generate/:jobId/status (real Postgres)", () => {
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

  async function insertJob(userId: string, applicationId: string, status: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs, status)
       VALUES ($1, $2, 'cover_letter', '{}', $3) RETURNING id`,
      [userId, applicationId, status],
    );
    return result.rows[0].id;
  }

  function getRequest(userId: string | null, jobId: string): Request {
    return new Request(`http://localhost:3000/api/generate/${jobId}/status`, {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function callRoute(request: Request, jobId: string) {
    return GET_(request, { params: Promise.resolve({ jobId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(getRequest(null, "any-id"), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent job", async () => {
    const userId = await insertUser("missing@example.com");
    const response = await callRoute(
      getRequest(userId, "00000000-0000-0000-0000-000000000000"),
      "00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(404);
  });

  it("returns 404 for a job belonging to a different user", async () => {
    const userId = await insertUser("victim@example.com");
    const attackerId = await insertUser("attacker@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId, "queued");

    const response = await callRoute(getRequest(attackerId, jobId), jobId);

    expect(response.status).toBe(404);
  });

  it("returns 200 with status queued", async () => {
    const userId = await insertUser("queued@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId, "queued");

    const response = await callRoute(getRequest(userId, jobId), jobId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "queued" });
  });

  it("returns 200 with the errorClass on a failed job", async () => {
    const userId = await insertUser("failed@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId, "failed");
    await pool.query("UPDATE generation_jobs SET error_class = 'safety_block' WHERE id = $1", [jobId]);

    const response = await callRoute(getRequest(userId, jobId), jobId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "failed", errorClass: "safety_block" });
  });

  it("returns 200 with the document on a succeeded job", async () => {
    const userId = await insertUser("succeeded@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = await insertJob(userId, applicationId, "succeeded");
    const documentResult = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model, job_id)
       VALUES ($1, $2, 'cover_letter', 'Dear Acme, ...', 'gemini', 'gemini-flash-latest', $3) RETURNING id`,
      [applicationId, userId, jobId],
    );

    const response = await callRoute(getRequest(userId, jobId), jobId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("succeeded");
    expect(body.document).toMatchObject({
      id: documentResult.rows[0].id,
      type: "cover_letter",
      content: "Dear Acme, ...",
    });
  });
});
