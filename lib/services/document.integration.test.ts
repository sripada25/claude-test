import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("document service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let updateDocumentContent: typeof import("./document.ts")["updateDocumentContent"];
  let listDocuments: typeof import("./document.ts")["listDocuments"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ updateDocumentContent, listDocuments } = await import("./document.ts"));

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

  async function insertDocument(userId: string): Promise<string> {
    const applicationResult = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    const documentResult = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'Original content', 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationResult.rows[0].id, userId],
    );
    return documentResult.rows[0].id;
  }

  async function insertApplication(userId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userId],
    );
    return result.rows[0].id;
  }

  async function insertDocumentFor(userId: string, applicationId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'content', 'gemini', 'gemini-flash-latest') RETURNING id`,
      [applicationId, userId],
    );
    return result.rows[0].id;
  }

  it("updates the content and returns the updated document", async () => {
    const userId = await insertUser("edit-success@example.com");
    const documentId = await insertDocument(userId);

    const result = await updateDocumentContent(userId, documentId, "Edited content");

    expect(result).toEqual({
      success: true,
      document: { id: documentId, type: "cover_letter", content: "Edited content", createdAt: expect.any(Date) },
    });
  });

  it("rejects empty content", async () => {
    const userId = await insertUser("edit-empty@example.com");
    const documentId = await insertDocument(userId);

    const result = await updateDocumentContent(userId, documentId, "");

    expect(result).toEqual({ success: false, reason: "empty_content" });
  });

  it("rejects whitespace-only content", async () => {
    const userId = await insertUser("edit-whitespace@example.com");
    const documentId = await insertDocument(userId);

    const result = await updateDocumentContent(userId, documentId, "   \n\t");

    expect(result).toEqual({ success: false, reason: "empty_content" });
  });

  it("returns not_found for a document belonging to a different user", async () => {
    const userId = await insertUser("edit-victim@example.com");
    const attackerId = await insertUser("edit-attacker@example.com");
    const documentId = await insertDocument(userId);

    const result = await updateDocumentContent(attackerId, documentId, "Hijacked content");

    expect(result).toEqual({ success: false, reason: "not_found" });
  });

  it("returns not_found for a nonexistent document", async () => {
    const userId = await insertUser("edit-missing@example.com");

    const result = await updateDocumentContent(userId, "00000000-0000-0000-0000-000000000000", "content");

    expect(result).toEqual({ success: false, reason: "not_found" });
  });

  describe("listDocuments", () => {
    it("returns the documents for a valid application", async () => {
      const userId = await insertUser("list-valid@example.com");
      const applicationId = await insertApplication(userId);
      const documentId = await insertDocumentFor(userId, applicationId);

      const result = await listDocuments(userId, applicationId);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toMatchObject({ id: documentId, type: "cover_letter", content: "content" });
    });

    it("returns an empty list for an application with no documents", async () => {
      const userId = await insertUser("list-empty@example.com");
      const applicationId = await insertApplication(userId);

      const result = await listDocuments(userId, applicationId);

      expect(result).toEqual({ success: true, documents: [] });
    });

    it("returns not_found for an application belonging to a different user", async () => {
      const userId = await insertUser("list-victim@example.com");
      const attackerId = await insertUser("list-attacker@example.com");
      const applicationId = await insertApplication(userId);

      const result = await listDocuments(attackerId, applicationId);

      expect(result).toEqual({ success: false, reason: "not_found" });
    });

    it("returns not_found for a nonexistent application", async () => {
      const userId = await insertUser("list-missing@example.com");

      const result = await listDocuments(userId, "00000000-0000-0000-0000-000000000000");

      expect(result).toEqual({ success: false, reason: "not_found" });
    });
  });
});
