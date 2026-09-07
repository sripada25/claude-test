import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("application-event service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let recordApplicationEvent: typeof import("./application-event.ts")["recordApplicationEvent"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ recordApplicationEvent } = await import("./application-event.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
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

  it("writes an event with the given type, description, and metadata", async () => {
    const userId = await insertUser("record@example.com");
    const applicationId = await insertApplication(userId);

    const result = await recordApplicationEvent({
      applicationId,
      userId,
      type: "status_changed",
      description: "Status changed to Interview",
      metadata: { from: "applied", to: "interview" },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.type).toBe("status_changed");
    expect(result.event.description).toBe("Status changed to Interview");
    expect(result.event.metadata).toEqual({ from: "applied", to: "interview" });
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const userId = await insertUser("no-metadata@example.com");
    const applicationId = await insertApplication(userId);

    const result = await recordApplicationEvent({
      applicationId,
      userId,
      type: "note_updated",
      description: "Note updated",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.metadata).toEqual({});
  });

  it("rejects an invalid event type without touching the database", async () => {
    const userId = await insertUser("bad-type@example.com");
    const applicationId = await insertApplication(userId);

    const result = await recordApplicationEvent({
      applicationId,
      userId,
      type: "bogus_type" as never,
      description: "x",
    });

    expect(result).toEqual({ success: false, reason: "invalid_type" });
    const rows = await pool.query("SELECT 1 FROM application_events WHERE application_id = $1", [
      applicationId,
    ]);
    expect(rows.rows).toHaveLength(0);
  });

  it("rejects an empty description without touching the database", async () => {
    const userId = await insertUser("bad-description@example.com");
    const applicationId = await insertApplication(userId);

    const result = await recordApplicationEvent({
      applicationId,
      userId,
      type: "note_updated",
      description: "   ",
    });

    expect(result).toEqual({ success: false, reason: "empty_description" });
    const rows = await pool.query("SELECT 1 FROM application_events WHERE application_id = $1", [
      applicationId,
    ]);
    expect(rows.rows).toHaveLength(0);
  });
});
