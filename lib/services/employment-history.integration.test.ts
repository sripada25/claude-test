import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("employment-history service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let listEmploymentHistory: typeof import("./employment-history.ts")["listEmploymentHistory"];
  let replaceEmploymentHistoryForUser: typeof import("./employment-history.ts")["replaceEmploymentHistoryForUser"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ listEmploymentHistory, replaceEmploymentHistoryForUser } = await import("./employment-history.ts"));

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

  it("replaces the whole list and returns entries with fresh ids", async () => {
    const userId = await insertUser("replace@example.com");

    const result = await replaceEmploymentHistoryForUser(userId, [
      { employer: "Acme", title: "Engineer", startDate: "2022-01-01", endDate: "2023-12-31" },
      { employer: "Globex", title: "Senior Engineer", startDate: "2024-01-01", endDate: null },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((entry) => typeof entry.id === "string")).toBe(true);
  });

  it("lists entries most-recent start_date first", async () => {
    const userId = await insertUser("order@example.com");
    await replaceEmploymentHistoryForUser(userId, [
      { employer: "Old Co", title: "Engineer", startDate: "2020-01-01", endDate: "2021-01-01" },
      { employer: "New Co", title: "Engineer", startDate: "2023-01-01", endDate: null },
    ]);

    const entries = await listEmploymentHistory(userId);

    expect(entries.map((entry) => entry.employer)).toEqual(["New Co", "Old Co"]);
  });

  it("trims employer and title", async () => {
    const userId = await insertUser("trim@example.com");

    const result = await replaceEmploymentHistoryForUser(userId, [
      { employer: "  Acme  ", title: "  Engineer  ", startDate: "2022-01-01", endDate: null },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entries[0].employer).toBe("Acme");
    expect(result.entries[0].title).toBe("Engineer");
  });

  it("rejects an empty employer or title", async () => {
    const userId = await insertUser("empty-fields@example.com");

    expect(
      await replaceEmploymentHistoryForUser(userId, [
        { employer: "", title: "Engineer", startDate: "2022-01-01", endDate: null },
      ]),
    ).toEqual({ success: false, reason: "invalid_entry" });

    expect(
      await replaceEmploymentHistoryForUser(userId, [
        { employer: "Acme", title: "   ", startDate: "2022-01-01", endDate: null },
      ]),
    ).toEqual({ success: false, reason: "invalid_entry" });
  });

  it("rejects a malformed date", async () => {
    const userId = await insertUser("bad-date@example.com");

    expect(
      await replaceEmploymentHistoryForUser(userId, [
        { employer: "Acme", title: "Engineer", startDate: "not-a-date", endDate: null },
      ]),
    ).toEqual({ success: false, reason: "invalid_entry" });
  });

  it("rejects an end date before the start date", async () => {
    const userId = await insertUser("bad-range@example.com");

    expect(
      await replaceEmploymentHistoryForUser(userId, [
        { employer: "Acme", title: "Engineer", startDate: "2023-06-01", endDate: "2023-01-01" },
      ]),
    ).toEqual({ success: false, reason: "invalid_entry" });
  });

  it("rejects more than 20 entries", async () => {
    const userId = await insertUser("too-many@example.com");
    const entries = Array.from({ length: 21 }, (_, i) => ({
      employer: `Co ${i}`,
      title: "Engineer",
      startDate: "2022-01-01",
      endDate: null,
    }));

    expect(await replaceEmploymentHistoryForUser(userId, entries)).toEqual({
      success: false,
      reason: "too_many_entries",
    });
  });

  it("clears all entries when replaced with an empty array", async () => {
    const userId = await insertUser("clear@example.com");
    await replaceEmploymentHistoryForUser(userId, [
      { employer: "Acme", title: "Engineer", startDate: "2022-01-01", endDate: null },
    ]);

    const result = await replaceEmploymentHistoryForUser(userId, []);

    expect(result).toEqual({ success: true, entries: [] });
    expect(await listEmploymentHistory(userId)).toEqual([]);
  });

  it("fully supersedes the prior set on a second replace - no leftover rows", async () => {
    const userId = await insertUser("supersede@example.com");
    await replaceEmploymentHistoryForUser(userId, [
      { employer: "First Co", title: "Engineer", startDate: "2020-01-01", endDate: "2021-01-01" },
    ]);

    await replaceEmploymentHistoryForUser(userId, [
      { employer: "Second Co", title: "Engineer", startDate: "2022-01-01", endDate: null },
    ]);

    const entries = await listEmploymentHistory(userId);
    expect(entries.map((entry) => entry.employer)).toEqual(["Second Co"]);
  });

  it("rejects an invalid entry inside a transaction without persisting any of the batch", async () => {
    const userId = await insertUser("partial-invalid@example.com");
    await replaceEmploymentHistoryForUser(userId, [
      { employer: "Existing Co", title: "Engineer", startDate: "2020-01-01", endDate: null },
    ]);

    await replaceEmploymentHistoryForUser(userId, [
      { employer: "Valid Co", title: "Engineer", startDate: "2022-01-01", endDate: null },
      { employer: "", title: "Engineer", startDate: "2022-01-01", endDate: null },
    ]);

    const entries = await listEmploymentHistory(userId);
    expect(entries.map((entry) => entry.employer)).toEqual(["Existing Co"]);
  });
});
