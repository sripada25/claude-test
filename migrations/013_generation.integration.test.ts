import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("013_generation migration (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let migrate: typeof import("../scripts/migrate.ts");
  let pool: typeof import("../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../scripts/migrate.ts");
    ({ pool } = await import("../lib/db.ts"));
  }, 60_000);

  afterEach(async () => {
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
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

  async function columnsOf(table: string) {
    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
    return result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));
  }

  it("creates documents with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("documents")).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "application_id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "type", type: "document_type", nullable: false },
      { name: "content", type: "text", nullable: false },
      { name: "jd_snapshot", type: "text", nullable: true },
      { name: "provider", type: "text", nullable: false },
      { name: "model", type: "text", nullable: false },
      { name: "r2_key", type: "text", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("creates generation_jobs with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("generation_jobs")).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "application_id", type: "uuid", nullable: false },
      { name: "type", type: "document_type", nullable: false },
      { name: "status", type: "job_status", nullable: false },
      { name: "attempts", type: "int2", nullable: false },
      { name: "error_class", type: "text", nullable: true },
      { name: "prompt_inputs", type: "jsonb", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "next_attempt_at", type: "timestamptz", nullable: true }, // added by 015
    ]);
  });

  it("creates ai_usage with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("ai_usage")).toEqual([
      { name: "id", type: "int8", nullable: false },
      { name: "user_id", type: "uuid", nullable: true },
      { name: "job_id", type: "uuid", nullable: true },
      { name: "provider", type: "text", nullable: false },
      { name: "model", type: "text", nullable: false },
      { name: "operation", type: "text", nullable: false },
      { name: "tokens_in", type: "int4", nullable: true },
      { name: "tokens_out", type: "int4", nullable: true },
      { name: "cost_estimate", type: "numeric", nullable: true },
      { name: "latency_ms", type: "int4", nullable: true },
      { name: "status", type: "text", nullable: false },
      { name: "error_class", type: "text", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("defaults generation_jobs.status to queued and attempts to 0", async () => {
    await migrate.up();
    const userId = await insertUser("defaults@example.com");
    const applicationId = await insertApplication(userId);

    const inserted = await pool.query<{ status: string; attempts: number }>(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs)
       VALUES ($1, $2, 'resume', '{}') RETURNING status, attempts`,
      [userId, applicationId],
    );

    expect(inserted.rows[0].status).toBe("queued");
    expect(inserted.rows[0].attempts).toBe(0);
  });

  it("cascades: deleting the application deletes its documents and generation_jobs", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-app@example.com");
    const applicationId = await insertApplication(userId);

    await pool.query(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'text', 'gemini', 'gemini-2.5')`,
      [applicationId, userId],
    );
    await pool.query(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs)
       VALUES ($1, $2, 'cover_letter', '{}')`,
      [userId, applicationId],
    );

    await pool.query("DELETE FROM applications WHERE id = $1", [applicationId]);

    expect((await pool.query("SELECT 1 FROM documents WHERE application_id = $1", [applicationId])).rows).toHaveLength(0);
    expect(
      (await pool.query("SELECT 1 FROM generation_jobs WHERE application_id = $1", [applicationId])).rows,
    ).toHaveLength(0);
  });

  it("cascades: deleting the user deletes their documents and generation_jobs, but ai_usage survives with user_id set to NULL", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-user@example.com");
    const applicationId = await insertApplication(userId);

    await pool.query(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'resume', 'text', 'gemini', 'gemini-2.5')`,
      [applicationId, userId],
    );
    const usage = await pool.query<{ id: string }>(
      `INSERT INTO ai_usage (user_id, provider, model, operation, status)
       VALUES ($1, 'gemini', 'gemini-2.5', 'cover_letter', 'succeeded') RETURNING id`,
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    expect((await pool.query("SELECT 1 FROM documents WHERE application_id = $1", [applicationId])).rows).toHaveLength(0);
    const survivingUsage = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM ai_usage WHERE id = $1",
      [usage.rows[0].id],
    );
    expect(survivingUsage.rows[0].user_id).toBeNull();
  });

  it("allows ai_usage.job_id with no FK enforcement", async () => {
    await migrate.up();
    const userId = await insertUser("no-fk@example.com");
    const randomJobId = "00000000-0000-0000-0000-000000000000";

    await expect(
      pool.query(
        `INSERT INTO ai_usage (user_id, job_id, provider, model, operation, status)
         VALUES ($1, $2, 'gemini', 'gemini-2.5', 'cover_letter', 'succeeded')`,
        [userId, randomJobId],
      ),
    ).resolves.toBeDefined();
  });

  it("has all four indexes with their exact definitions", async () => {
    await migrate.up();

    const indexes = await pool.query<{ tablename: string; indexname: string; indexdef: string }>(
      `SELECT tablename, indexname, indexdef FROM pg_indexes
       WHERE tablename IN ('documents', 'generation_jobs', 'ai_usage')`,
    );
    const byName = Object.fromEntries(indexes.rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.idx_documents_application).toContain("(application_id, created_at DESC)");
    expect(byName.idx_jobs_queue).toContain(
      "WHERE (status = ANY (ARRAY['queued'::job_status, 'running'::job_status]))",
    );
    expect(byName.idx_jobs_user).toContain("(user_id, created_at DESC)");
    expect(byName.idx_ai_usage_cost).toContain("(created_at DESC)");
    expect(byName.idx_ai_usage_user).toContain("(user_id, created_at DESC)");
  });

  it("is fully reversible: down() drops everything, and up() re-applies cleanly", async () => {
    await migrate.up();

    // down() only reverts the single most-recently-applied migration, so
    // keep reverting until 013 itself is undone - resilient to any
    // migration added after this one (e.g. 014).
    async function documentsTableExists(): Promise<boolean> {
      const result = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'documents'`,
      );
      return result.rows.length > 0;
    }
    while (await documentsTableExists()) {
      await migrate.down();
    }

    for (const table of ["documents", "generation_jobs", "ai_usage"]) {
      const result = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      expect(result.rows).toHaveLength(0);
    }

    await expect(migrate.up()).resolves.not.toThrow();

    for (const table of ["documents", "generation_jobs", "ai_usage"]) {
      const result = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      expect(result.rows).toHaveLength(1);
    }
  });
});
