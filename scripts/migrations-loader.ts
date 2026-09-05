import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Migration {
  id: string;
  upPath: string;
  downPath: string;
}

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = await readdir(dir);
  const upFiles = files.filter((file) => /^\d+_.+\.up\.sql$/.test(file));

  const migrations = upFiles.map((upFile) => {
    const id = upFile.replace(/\.up\.sql$/, "");
    const downFile = `${id}.down.sql`;
    if (!files.includes(downFile)) {
      throw new Error(`Migration ${id} has no matching down file: ${downFile}`);
    }
    return {
      id,
      upPath: join(dir, upFile),
      downPath: join(dir, downFile),
    };
  });

  migrations.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  return migrations;
}
