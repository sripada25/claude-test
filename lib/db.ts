import { Pool, type PoolClient, types } from "pg";
import { env } from "./env.ts";

// node-postgres parses DATE columns (OID 1082) into JS Date objects using
// the Node process's local timezone by default. Serializing that Date via
// NextResponse.json() -> JSON.stringify() -> toISOString() then shifts it
// to UTC, corrupting the calendar date whenever the server's local UTC
// offset isn't zero (found 2026-09-08 rendering `date_applied`). Keep DATE
// columns as the raw "YYYY-MM-DD" string instead - there's no time
// component to parse, so a Date object adds nothing but this bug.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// A repository function taking this can run standalone (pass `pool`) or as
// part of a caller's transaction (pass the in-transaction `client`).
export type Queryable = Pool | PoolClient;
