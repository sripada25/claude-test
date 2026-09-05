import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadMigrations } from "./migrations-loader.ts";

describe("migrate up/down (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let migrate: typeof import("./migrate.ts");
  let pool: typeof import("../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("./migrate.ts");
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

  it("applies every defined migration and records each one", async () => {
    await migrate.up();

    const allMigrations = await loadMigrations();
    const applied = await pool.query<{ id: string }>("SELECT id FROM schema_migrations");

    expect(applied.rows.map((row) => row.id).sort()).toEqual(
      allMigrations.map((migration) => migration.id).sort(),
    );
  });

  it("is idempotent — running up twice applies nothing new the second time", async () => {
    await migrate.up();
    const before = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );

    await migrate.up();
    const after = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );

    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it("down reverts exactly the most recently applied migration, then up re-applies it", async () => {
    await migrate.up();
    const before = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );

    await migrate.down();
    const afterDown = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );
    expect(afterDown.rows[0].count).toBe(before.rows[0].count - 1);

    await migrate.up();
    const afterReapply = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );
    expect(afterReapply.rows[0].count).toBe(before.rows[0].count);
  });

  it("down with nothing applied is a no-op, not an error", async () => {
    await expect(migrate.down()).resolves.toBeUndefined();

    const applied = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );
    expect(applied.rows[0].count).toBe(0);
  });
});
