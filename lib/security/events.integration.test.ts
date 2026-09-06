import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

describe("logSecurityEvent (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let events: typeof import("./events.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    events = await import("./events.ts");

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    try {
      await pool.query("DELETE FROM security_events");
      await pool.query("DELETE FROM users");
    } catch {
      // Pool already ended by the "unreachable database" test - fine.
    }
  });

  afterAll(async () => {
    try {
      await pool.end();
    } catch {
      // Already ended by the "unreachable database" test below - fine.
    }
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  it("inserts a row with the correct fields", async () => {
    const userId = await insertUser("audited@example.com");

    await events.logSecurityEvent("login_success", {
      userId,
      ip: "203.0.113.5",
      userAgent: "vitest",
      metadata: { via: "password" },
    });

    const result = await pool.query(
      "SELECT event_type, user_id, ip, user_agent, metadata FROM security_events",
    );
    expect(result.rows).toEqual([
      {
        event_type: "login_success",
        user_id: userId,
        ip: "203.0.113.5",
        user_agent: "vitest",
        metadata: { via: "password" },
      },
    ]);
  });

  it("inserts user_id NULL when no userId is given", async () => {
    await events.logSecurityEvent("login_failed", { ip: "203.0.113.5" });

    const result = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM security_events",
    );
    expect(result.rows[0].user_id).toBeNull();
  });

  it("defaults metadata to {} when not given", async () => {
    await events.logSecurityEvent("permission_denied");

    const result = await pool.query<{ metadata: Record<string, unknown> }>(
      "SELECT metadata FROM security_events",
    );
    expect(result.rows[0].metadata).toEqual({});
  });

  it("resolves instead of throwing when the database is unreachable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await pool.end();
    await expect(events.logSecurityEvent("session_resolution_failed")).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
