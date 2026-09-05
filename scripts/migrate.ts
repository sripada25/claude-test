import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "../lib/db.ts";
import { loadMigrations } from "./migrations-loader.ts";

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedIds(): Promise<Set<string>> {
  const result = await pool.query<{ id: string }>("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function runInTransaction(sql: string, after: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await after(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function up(): Promise<void> {
  await ensureMigrationsTable();
  const migrations = await loadMigrations();
  const applied = await getAppliedIds();
  const pending = migrations.filter((migration) => !applied.has(migration.id));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const migration of pending) {
    const sql = await readFile(migration.upPath, "utf8");
    try {
      await runInTransaction(sql, async (client) => {
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      });
      console.log(`Applied ${migration.id}`);
    } catch (err) {
      console.error(`Failed to apply ${migration.id}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }
}

export async function down(): Promise<void> {
  await ensureMigrationsTable();
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1",
  );

  if (result.rows.length === 0) {
    console.log("No migrations to revert.");
    return;
  }

  const id = result.rows[0].id;
  const migrations = await loadMigrations();
  const migration = migrations.find((candidate) => candidate.id === id);
  if (!migration) {
    throw new Error(`Applied migration ${id} has no matching file on disk.`);
  }

  const sql = await readFile(migration.downPath, "utf8");
  try {
    await runInTransaction(sql, async (client) => {
      await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
    });
    console.log(`Reverted ${migration.id}`);
  } catch (err) {
    console.error(`Failed to revert ${migration.id}:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] === "down" ? "down" : "up";
  await (mode === "down" ? down() : up());
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .then(async () => {
      await pool.end();
    })
    .catch(async (err) => {
      console.error(err instanceof Error ? err.message : err);
      await pool.end();
      process.exitCode = 1;
    });
}
