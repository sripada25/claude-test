import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("011_application_events migration (real Postgres)", () => {
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

  it("creates application_events with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'application_events'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "id", type: "int8", nullable: false },
      { name: "application_id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "type", type: "event_type", nullable: false },
      { name: "description", type: "text", nullable: false },
      { name: "metadata", type: "jsonb", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("defaults metadata to an empty object and rejects an unknown event type", async () => {
    await migrate.up();
    const userId = await insertUser("defaults@example.com");
    const applicationId = await insertApplication(userId);

    const inserted = await pool.query<{ metadata: Record<string, unknown> }>(
      `INSERT INTO application_events (application_id, user_id, type, description)
       VALUES ($1, $2, 'created', 'Application created') RETURNING metadata`,
      [applicationId, userId],
    );
    expect(inserted.rows[0].metadata).toEqual({});

    await expect(
      pool.query(
        `INSERT INTO application_events (application_id, user_id, type, description)
         VALUES ($1, $2, 'bogus_type', 'x')`,
        [applicationId, userId],
      ),
    ).rejects.toThrow();
  });

  it("has idx_events_application on (application_id, created_at desc)", async () => {
    await migrate.up();

    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'application_events'`,
    );
    expect(indexes.rows.map((row) => row.indexname)).toContain("idx_events_application");
  });

  it("cascades: deleting the application deletes its events", async () => {
    await migrate.up();
    const userId = await insertUser("app-cascade@example.com");
    const applicationId = await insertApplication(userId);
    await pool.query(
      `INSERT INTO application_events (application_id, user_id, type, description)
       VALUES ($1, $2, 'created', 'Application created')`,
      [applicationId, userId],
    );

    await pool.query("DELETE FROM applications WHERE id = $1", [applicationId]);

    const result = await pool.query("SELECT 1 FROM application_events WHERE application_id = $1", [
      applicationId,
    ]);
    expect(result.rows).toHaveLength(0);
  });

  it("cascades: deleting the user deletes their applications and events", async () => {
    await migrate.up();
    const userId = await insertUser("user-cascade@example.com");
    const applicationId = await insertApplication(userId);
    await pool.query(
      `INSERT INTO application_events (application_id, user_id, type, description)
       VALUES ($1, $2, 'created', 'Application created')`,
      [applicationId, userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM application_events WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });
});
