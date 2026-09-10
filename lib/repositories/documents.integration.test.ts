import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("documents repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let copyJobDescriptionToSnapshotlessDocuments: typeof import("./documents.ts")["copyJobDescriptionToSnapshotlessDocuments"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ copyJobDescriptionToSnapshotlessDocuments } = await import("./documents.ts"));

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
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertDocument(
    userId: string,
    applicationId: string,
    jdSnapshot: string | null,
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, jd_snapshot, provider, model)
       VALUES ($1, $2, 'cover_letter', 'content', $3, 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationId, userId, jdSnapshot],
    );
    return result.rows[0].id;
  }

  async function jdSnapshotOf(documentId: string): Promise<string | null> {
    const result = await pool.query<{ jd_snapshot: string | null }>(
      "SELECT jd_snapshot FROM documents WHERE id = $1",
      [documentId],
    );
    return result.rows[0].jd_snapshot;
  }

  it("copies the old JD into a document with a NULL jd_snapshot", async () => {
    const userId = await insertUser("null-snapshot@example.com");
    const applicationId = await insertApplication(userId);
    const documentId = await insertDocument(userId, applicationId, null);

    await copyJobDescriptionToSnapshotlessDocuments(pool, applicationId, "Old JD text");

    expect(await jdSnapshotOf(documentId)).toBe("Old JD text");
  });

  it("leaves a document that already has a jd_snapshot untouched", async () => {
    const userId = await insertUser("already-snapshotted@example.com");
    const applicationId = await insertApplication(userId);
    const documentId = await insertDocument(userId, applicationId, "Already snapshotted JD");

    await copyJobDescriptionToSnapshotlessDocuments(pool, applicationId, "Old JD text");

    expect(await jdSnapshotOf(documentId)).toBe("Already snapshotted JD");
  });

  it("does not touch a document belonging to a different application", async () => {
    const userId = await insertUser("other-application@example.com");
    const applicationId = await insertApplication(userId);
    const otherApplicationId = await insertApplication(userId);
    const documentId = await insertDocument(userId, otherApplicationId, null);

    await copyJobDescriptionToSnapshotlessDocuments(pool, applicationId, "Old JD text");

    expect(await jdSnapshotOf(documentId)).toBeNull();
  });
});
