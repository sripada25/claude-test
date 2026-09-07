import {
  deleteOauthAccountForUser,
  listOauthAccountsForUser,
  type OauthConnection,
} from "../repositories/oauth-account.ts";
import type { OauthProvider } from "../repositories/oauth-state.ts";
import { hasPasswordHash } from "../repositories/user.ts";
import { logSecurityEvent } from "../security/events.ts";

export async function listConnections(
  userId: string,
): Promise<{ connections: OauthConnection[]; hasPassword: boolean }> {
  const [connections, hasPassword] = await Promise.all([
    listOauthAccountsForUser(userId),
    hasPasswordHash(userId),
  ]);
  return { connections, hasPassword };
}

export type RemoveConnectionResult =
  | { success: true }
  | { success: false; reason: "not_found" | "last_credential" };

// DATABASE_quarterfinal.md §9: a user must always have at least one usable
// credential - removing the last oauth_account from a passwordless user
// would permanently lock them out.
export async function removeConnection(
  userId: string,
  provider: OauthProvider,
): Promise<RemoveConnectionResult> {
  const [connections, hasPassword] = await Promise.all([
    listOauthAccountsForUser(userId),
    hasPasswordHash(userId),
  ]);

  if (!connections.some((connection) => connection.provider === provider)) {
    return { success: false, reason: "not_found" };
  }

  if (!hasPassword && connections.length === 1) {
    return { success: false, reason: "last_credential" };
  }

  await deleteOauthAccountForUser(userId, provider);
  await logSecurityEvent("oauth_unlinked", { userId, metadata: { provider } });
  return { success: true };
}
