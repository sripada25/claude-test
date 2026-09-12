import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("022_token_purpose_contact_email_verify migration (real Postgres)", () => {
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
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      [email],
    );
    return result.rows[0].id;
  }

  async function insertToken(userId: string): Promise<void> {
    await pool.query(
      `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, 'hash', 'contact_email_verify', now() + interval '10 minutes')`,
      [userId],
    );
  }

  it("allows contact_email_verify as a verification_tokens.purpose value", async () => {
    await migrate.up();
    const userId = await insertUser("enum-up@example.com");

    await expect(insertToken(userId)).resolves.not.toThrow();
  });

  it("existing purpose values still work after the addition", async () => {
    await migrate.up();
    const userId = await insertUser("enum-existing@example.com");

    await expect(
      pool.query(
        `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at)
         VALUES ($1, 'hash', 'verify_email', now() + interval '10 minutes')`,
        [userId],
      ),
    ).resolves.not.toThrow();
  });

  it("is reversible: down() removes contact_email_verify, up() restores it", async () => {
    await migrate.up();
    const userId = await insertUser("enum-reversible@example.com");

    await migrate.down();
    await expect(insertToken(userId)).rejects.toThrow();

    await expect(migrate.up()).resolves.not.toThrow();
    await expect(insertToken(userId)).resolves.not.toThrow();
  });
});
