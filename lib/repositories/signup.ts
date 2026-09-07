import { pool } from "../db.ts";

export async function createAccount(params: {
  email: string;
  passwordHash: string;
  timezone: string;
  periodStart: string;
}): Promise<{ userId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id`,
      [params.email, params.passwordHash, params.timezone],
    );
    const userId = userResult.rows[0].id;

    await client.query(`INSERT INTO profiles (user_id, full_name) VALUES ($1, '')`, [userId]);
    await client.query(
      `INSERT INTO subscriptions (user_id, trial_ends_at) VALUES ($1, now() + interval '12 days')`,
      [userId],
    );
    await client.query(`INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)`, [
      userId,
      params.periodStart,
    ]);

    await client.query("COMMIT");
    return { userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
