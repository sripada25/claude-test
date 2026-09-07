import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("profile service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let getProfile: typeof import("./profile.ts")["getProfile"];
  let updateProfile: typeof import("./profile.ts")["updateProfile"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ getProfile, updateProfile } = await import("./profile.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithProfile(email: string, fullName = "Original Name"): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    const userId = userResult.rows[0].id;
    await pool.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)", [
      userId,
      fullName,
    ]);
    return userId;
  }

  it("returns the current profile", async () => {
    const userId = await insertUserWithProfile("get@example.com", "Jane Doe");

    const profile = await getProfile(userId);

    expect(profile.fullName).toBe("Jane Doe");
    expect(profile.skills).toEqual([]);
    expect(profile.completedAt).toBeNull();
  });

  it("updates only the provided fields, leaving others untouched", async () => {
    const userId = await insertUserWithProfile("partial@example.com", "Original Name");
    await pool.query("UPDATE profiles SET target_role = 'Engineer' WHERE user_id = $1", [userId]);

    const result = await updateProfile(userId, { currentRole: "Senior Engineer" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.profile.currentRole).toBe("Senior Engineer");
    expect(result.profile.targetRole).toBe("Engineer");
    expect(result.profile.fullName).toBe("Original Name");
  });

  it("reads back current_role correctly - it's a reserved SQL keyword, easy to leave unquoted", async () => {
    const userId = await insertUserWithProfile("current-role@example.com");

    await updateProfile(userId, { currentRole: "Software Engineer" });
    const reread = await getProfile(userId);

    expect(reread.currentRole).toBe("Software Engineer");
  });

  it("normalizes skills - lowercase, deduped, capped at 30", async () => {
    const userId = await insertUserWithProfile("skills@example.com");
    const skills = [
      "React",
      "react",
      " TypeScript ",
      ...Array.from({ length: 35 }, (_, i) => `skill-${i}`),
    ];

    const result = await updateProfile(userId, { skills });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.profile.skills).toHaveLength(30);
    expect(result.profile.skills).toContain("react");
    expect(result.profile.skills).toContain("typescript");
    expect(result.profile.skills.filter((s) => s === "react")).toHaveLength(1);
  });

  it("rejects an empty full name", async () => {
    const userId = await insertUserWithProfile("empty-name@example.com");

    const result = await updateProfile(userId, { fullName: "   " });

    expect(result).toEqual({ success: false, reason: "empty_full_name" });
  });

  it("rejects out-of-range experience values", async () => {
    const userId = await insertUserWithProfile("bad-experience@example.com");

    expect(await updateProfile(userId, { yearsExperience: 61 })).toEqual({
      success: false,
      reason: "invalid_experience",
    });
    expect(await updateProfile(userId, { monthsExperience: 12 })).toEqual({
      success: false,
      reason: "invalid_experience",
    });
  });

  it("rejects a partial salary triple; accepts all-three or none", async () => {
    const userId = await insertUserWithProfile("salary@example.com");

    expect(await updateProfile(userId, { salaryAmount: 1000000 })).toEqual({
      success: false,
      reason: "incomplete_salary",
    });

    const complete = await updateProfile(userId, {
      salaryAmount: 1000000,
      salaryCurrency: "INR",
      salaryPeriod: "annual",
    });
    expect(complete.success).toBe(true);

    const cleared = await updateProfile(userId, {
      salaryAmount: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
    expect(cleared.success).toBe(true);
  });

  it("never sets completed_at or source", async () => {
    const userId = await insertUserWithProfile("no-completed-at@example.com");

    await updateProfile(userId, { fullName: "Updated Name" });

    const row = await pool.query<{ completed_at: Date | null; source: string }>(
      "SELECT completed_at, source FROM profiles WHERE user_id = $1",
      [userId],
    );
    expect(row.rows[0].completed_at).toBeNull();
    expect(row.rows[0].source).toBe("manual");
  });
});
