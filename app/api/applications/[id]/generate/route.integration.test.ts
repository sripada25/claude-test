import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/applications/:id/generate (real Postgres)", () => {
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

  async function setupReadyToGenerate(email: string): Promise<{ userId: string; applicationId: string }> {
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

    return { userId, applicationId: applicationResult.rows[0].id };
  }

  function postRequest(userId: string | null, applicationId: string, body: unknown): Request {
    return new Request(`http://localhost:3000/api/applications/${applicationId}/generate`, {
      method: "POST",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  function callRoute(request: Request, applicationId: string) {
    return POST_(request, { params: Promise.resolve({ id: applicationId }) });
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(postRequest(null, "any-id", { type: "cover_letter" }), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing type", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("missing-type@example.com");

    const response = await callRoute(postRequest(userId, applicationId, {}), applicationId);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid_type" });
  });

  it("returns 400 for an invalid type value", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("invalid-type@example.com");

    const response = await callRoute(
      postRequest(userId, applicationId, { type: "not-a-real-type" }),
      applicationId,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid_type" });
  });

  it("returns 404 for an application that doesn't exist", async () => {
    const { userId } = await setupReadyToGenerate("not-found@example.com");
    const missingId = "00000000-0000-0000-0000-000000000000";

    const response = await callRoute(postRequest(userId, missingId, { type: "cover_letter" }), missingId);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, reason: "not_found" });
  });

  it("returns 403 for a service-level policy rejection", async () => {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      ["unverified@example.com"],
    );
    const userId = userResult.rows[0].id;
    await pool.query(`INSERT INTO subscriptions (user_id) VALUES ($1)`, [userId]);
    await pool.query(`INSERT INTO profiles (user_id, full_name) VALUES ($1, 'Jane Doe')`, [userId]);
    const applicationResult = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, job_description) VALUES ($1, 'Acme', 'Engineer', 'JD') RETURNING id`,
      [userId],
    );

    const response = await callRoute(
      postRequest(userId, applicationResult.rows[0].id, { type: "cover_letter" }),
      applicationResult.rows[0].id,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, reason: "email_not_verified" });
  });

  it("returns 202 with a jobId on success", async () => {
    const { userId, applicationId } = await setupReadyToGenerate("success@example.com");

    const response = await callRoute(postRequest(userId, applicationId, { type: "resume" }), applicationId);

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.status).toBe("queued");
    expect(typeof body.jobId).toBe("string");

    const job = await pool.query("SELECT type, status FROM generation_jobs WHERE id = $1", [body.jobId]);
    expect(job.rows[0]).toMatchObject({ type: "resume", status: "queued" });
  });
});
