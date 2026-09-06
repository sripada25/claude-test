import { createHash, randomBytes } from "node:crypto";
import {
  findActiveSessionByTokenHash,
  insertSession,
  revokeAllSessionsForUser,
  revokeSessionByTokenHash,
} from "../repositories/session.ts";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function issueSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await insertSession({
    userId,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { rawToken, expiresAt };
}

export async function resolveSession(
  rawToken: string,
): Promise<{ userId: string; sessionId: string } | null> {
  const session = await findActiveSessionByTokenHash(hashToken(rawToken));

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return { userId: session.userId, sessionId: session.id };
}

export async function revokeSession(rawToken: string): Promise<void> {
  await revokeSessionByTokenHash(hashToken(rawToken));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await revokeAllSessionsForUser(userId);
}
