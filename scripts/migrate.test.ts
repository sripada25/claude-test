import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations } from "./migrations-loader.ts";

describe("loadMigrations", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "trackr-migrations-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("orders migrations numerically, not lexicographically", async () => {
    await writeFile(join(dir, "002_second.up.sql"), "-- second");
    await writeFile(join(dir, "002_second.down.sql"), "-- second down");
    await writeFile(join(dir, "010_tenth.up.sql"), "-- tenth");
    await writeFile(join(dir, "010_tenth.down.sql"), "-- tenth down");
    await writeFile(join(dir, "001_first.up.sql"), "-- first");
    await writeFile(join(dir, "001_first.down.sql"), "-- first down");

    const migrations = await loadMigrations(dir);

    expect(migrations.map((migration) => migration.id)).toEqual([
      "001_first",
      "002_second",
      "010_tenth",
    ]);
  });

  it("ignores files that are not numbered .up.sql migrations", async () => {
    await writeFile(join(dir, "001_first.up.sql"), "-- first");
    await writeFile(join(dir, "001_first.down.sql"), "-- first down");
    await writeFile(join(dir, "readme.md"), "not a migration");
    await writeFile(join(dir, "001_first.down.sql.bak"), "not a migration either");

    const migrations = await loadMigrations(dir);

    expect(migrations).toHaveLength(1);
    expect(migrations[0].id).toBe("001_first");
  });

  it("throws when a migration has no matching down file", async () => {
    await writeFile(join(dir, "001_first.up.sql"), "-- first");

    await expect(loadMigrations(dir)).rejects.toThrow(
      "Migration 001_first has no matching down file: 001_first.down.sql",
    );
  });
});
