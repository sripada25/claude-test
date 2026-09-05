import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // Integration tests set process.env.DATABASE_URL per file to point at
    // their own Testcontainers Postgres. The default "threads" pool can run
    // files concurrently in the same process, so that env var races across
    // files. "forks" isolates each file in its own OS process instead.
    pool: "forks",
  },
});
