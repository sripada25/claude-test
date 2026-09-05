import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
    await pool.query("DROP TABLE IF EXISTS schema_migrations");
    await pool.query("DROP EXTENSION IF EXISTS pgcrypto");
    await pool.query("DROP EXTENSION IF EXISTS citext");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it("applies the baseline migration and records it", async () => {
    await migrate.up();

    const applied = await pool.query("SELECT id FROM schema_migrations");
    expect(applied.rows.map((row: { id: string }) => row.id)).toEqual(["001_baseline"]);

    const extensions = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('citext', 'pgcrypto') ORDER BY extname",
    );
    expect(extensions.rows.map((row: { extname: string }) => row.extname)).toEqual([
      "citext",
      "pgcrypto",
    ]);
  });

  it("is idempotent — running up twice applies the migration only once", async () => {
    await migrate.up();
    await migrate.up();

    const applied = await pool.query("SELECT id FROM schema_migrations");
    expect(applied.rows).toHaveLength(1);
  });

  it("down reverts the applied migration, then up re-applies it cleanly", async () => {
    await migrate.up();
    await migrate.down();

    const afterDown = await pool.query("SELECT id FROM schema_migrations");
    expect(afterDown.rows).toHaveLength(0);

    await migrate.up();

    const afterReapply = await pool.query("SELECT id FROM schema_migrations");
    expect(afterReapply.rows.map((row: { id: string }) => row.id)).toEqual(["001_baseline"]);
  });

  it("down with nothing applied is a no-op, not an error", async () => {
    await expect(migrate.down()).resolves.toBeUndefined();

    const applied = await pool.query("SELECT id FROM schema_migrations");
    expect(applied.rows).toHaveLength(0);
  });
});
