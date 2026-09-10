import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("documents repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let copyJobDescriptionToSnapshotlessDocuments: typeof import("./documents.ts")["copyJobDescriptionToSnapshotlessDocuments"];
  let findDocumentByJobId: typeof import("./documents.ts")["findDocumentByJobId"];
  let findDocumentForUser: typeof import("./documents.ts")["findDocumentForUser"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ copyJobDescriptionToSnapshotlessDocuments, findDocumentByJobId, findDocumentForUser } =
      await import("./documents.ts"));

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
    jobId: string | null = null,
  ): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, jd_snapshot, provider, model, job_id)
       VALUES ($1, $2, 'cover_letter', 'content', $3, 'gemini', 'gemini-flash-latest', $4) RETURNING id`,
      [applicationId, userId, jdSnapshot, jobId],
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

  it("findDocumentByJobId finds the document produced by that job", async () => {
    const userId = await insertUser("find-by-job@example.com");
    const applicationId = await insertApplication(userId);
    const jobId = crypto.randomUUID();
    const documentId = await insertDocument(userId, applicationId, null, jobId);

    const found = await findDocumentByJobId(jobId);

    expect(found).toMatchObject({ id: documentId, type: "cover_letter", content: "content" });
  });

  it("findDocumentByJobId returns null when no document has that job_id", async () => {
    const found = await findDocumentByJobId(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it("findDocumentForUser returns the document for its owner", async () => {
    const userId = await insertUser("find-for-user-owner@example.com");
    const applicationId = await insertApplication(userId);
    const documentId = await insertDocument(userId, applicationId, null);

    const found = await findDocumentForUser(documentId, userId);

    expect(found).toEqual({ id: documentId, applicationId, type: "cover_letter" });
  });

  it("findDocumentForUser returns null for a document belonging to a different user", async () => {
    const userId = await insertUser("find-for-user-victim@example.com");
    const otherUserId = await insertUser("find-for-user-attacker@example.com");
    const applicationId = await insertApplication(userId);
    const documentId = await insertDocument(userId, applicationId, null);

    const found = await findDocumentForUser(documentId, otherUserId);

    expect(found).toBeNull();
  });

  it("findDocumentForUser returns null for a nonexistent document", async () => {
    const userId = await insertUser("find-for-user-missing@example.com");

    const found = await findDocumentForUser("00000000-0000-0000-0000-000000000000", userId);

    expect(found).toBeNull();
  });
});
