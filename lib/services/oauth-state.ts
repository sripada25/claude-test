import { createHash, randomBytes } from "node:crypto";
import {
  consumeOauthState as consumeOauthStateRow,
  insertOauthState,
  type OauthProvider,
} from "../repositories/oauth-state.ts";

const STATE_DURATION_MS = 10 * 60 * 1000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createOauthState(params: {
  provider: OauthProvider;
  redirectPath?: string | null;
  userId?: string | null;
}): Promise<{ state: string; codeVerifier: string; codeChallenge: string }> {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  await insertOauthState({
    stateHash: sha256(state),
    provider: params.provider,
    codeVerifier,
    redirectPath: params.redirectPath ?? null,
    userId: params.userId ?? null,
    expiresAt: new Date(Date.now() + STATE_DURATION_MS),
  });

  return { state, codeVerifier, codeChallenge };
}

export async function consumeOauthState(
  state: string,
  provider: OauthProvider,
): Promise<{ codeVerifier: string; redirectPath: string | null; userId: string | null } | null> {
  return consumeOauthStateRow(sha256(state), provider);
}
