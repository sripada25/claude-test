import { Pool, type PoolClient } from "pg";
import { env } from "./env.ts";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// A repository function taking this can run standalone (pass `pool`) or as
// part of a caller's transaction (pass the in-transaction `client`).
export type Queryable = Pool | PoolClient;
