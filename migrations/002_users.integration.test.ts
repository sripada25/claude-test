import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("002_users migration (real Postgres)", () => {
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

  it("creates users with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'users'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "email", type: "citext", nullable: false },
      { name: "password_hash", type: "text", nullable: true },
      { name: "email_verified_at", type: "timestamptz", nullable: true },
      { name: "timezone", type: "text", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "updated_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("enforces case-insensitive email uniqueness", async () => {
    await migrate.up();

    await pool.query("INSERT INTO users (email, timezone) VALUES ($1, $2)", [
      "person@example.com",
      "Asia/Kolkata",
    ]);

    await expect(
      pool.query("INSERT INTO users (email, timezone) VALUES ($1, $2)", [
        "PERSON@example.com",
        "Asia/Kolkata",
      ]),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("defaults id to a generated UUID and allows a NULL password_hash", async () => {
    await migrate.up();

    const result = await pool.query<{ id: string; password_hash: string | null }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id, password_hash",
      ["sso-user@example.com", "UTC"],
    );

    expect(result.rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.rows[0].password_hash).toBeNull();
  });

  it("down reverts users, then up re-creates it, without touching the baseline extensions", async () => {
    await migrate.up();
    await migrate.down();

    const usersExistsAfterDown = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AS exists",
    );
    expect(usersExistsAfterDown.rows[0].exists).toBe(false);

    const extensionsAfterDown = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('citext', 'pgcrypto')",
    );
    expect(extensionsAfterDown.rows).toHaveLength(2);

    await migrate.up();

    const usersExistsAfterReapply = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AS exists",
    );
    expect(usersExistsAfterReapply.rows[0].exists).toBe(true);
  });
});
