import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/documents/:id/regenerate (real Postgres)", () => {
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

  async function setupReadyToRegenerate(email: string): Promise<{ userId: string; documentId: string }> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone, email_verified_at) VALUES ($1, 'Asia/Kolkata', now()) RETURNING id",
      [email],
    );
    const userId = userResult.rows[0].id;

    await pool.query(`INSERT INTO subscriptions (user_id, status, tier) VALUES ($1, 'active', 'free')`, [userId]);

    await pool.query(
      `INSERT INTO profiles (user_id, full_name, target_role, skills, years_experience, months_experience, completed_at)
       VALUES ($1, 'Jane Doe', 'Senior Engineer', '{react}', 3, 0, now())`,
      [userId],
    );

    const applicationResult = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, job_description) VALUES ($1, 'Acme', 'Engineer', 'A job description') RETURNING id`,
      [userId],
    );

    const documentResult = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'Dear Acme, ...', 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationResult.rows[0].id, userId],
    );

    return { userId, documentId: documentResult.rows[0].id };
  }

  function postRequest(userId: string | null, documentId: string): Request {
    return new Request(`http://localhost:3000/api/documents/${documentId}/regenerate`, {
      method: "POST",
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function callRoute(request: Request, documentId: string) {
    return POST_(request, { params: Promise.resolve({ id: documentId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(postRequest(null, "any-id"), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent document", async () => {
    const { userId } = await setupReadyToRegenerate("missing@example.com");
    const missingId = "00000000-0000-0000-0000-000000000000";

    const response = await callRoute(postRequest(userId, missingId), missingId);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, reason: "not_found" });
  });

  it("returns 404 for a document belonging to a different user", async () => {
    const { documentId } = await setupReadyToRegenerate("victim@example.com");
    const { userId: attackerId } = await setupReadyToRegenerate("attacker@example.com");

    const response = await callRoute(postRequest(attackerId, documentId), documentId);

    expect(response.status).toBe(404);
  });

  it("returns 202 with a jobId on success", async () => {
    const { userId, documentId } = await setupReadyToRegenerate("success@example.com");

    const response = await callRoute(postRequest(userId, documentId), documentId);

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.status).toBe("queued");
    expect(typeof body.jobId).toBe("string");

    const job = await pool.query("SELECT type, status FROM generation_jobs WHERE id = $1", [body.jobId]);
    expect(job.rows[0]).toMatchObject({ type: "cover_letter", status: "queued" });
  });
});
