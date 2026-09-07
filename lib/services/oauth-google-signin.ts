import { exchangeGoogleAuthorizationCode } from "../oauth/google.ts";
import {
  createUserWithOauth,
  findOauthAccountByProviderSub,
  linkOauthAccount,
  linkOauthAndInvalidatePassword,
} from "../repositories/oauth-account.ts";
import { consumeOauthState } from "./oauth-state.ts";
import { findUserByEmail } from "../repositories/user.ts";
import { logSecurityEvent } from "../security/events.ts";
import { issueSession } from "./session.ts";

export type CompleteGoogleSignInResult =
  | { success: true; rawToken: string; expiresAt: Date }
  | {
      success: false;
      reason: "state_mismatch" | "exchange_failed" | "email_not_verified";
    };

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function currentMonthStart(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function completeGoogleSignIn(params: {
  queryState: string | null;
  cookieState: string | null;
  code: string | null;
  timezone: string | null;
  redirectUri: string;
}): Promise<CompleteGoogleSignInResult> {
  if (!params.queryState || !params.cookieState || params.queryState !== params.cookieState) {
    await logSecurityEvent("oauth_state_mismatch");
    return { success: false, reason: "state_mismatch" };
  }

  const consumed = await consumeOauthState(params.queryState, "google");
  if (!consumed) {
    await logSecurityEvent("oauth_state_mismatch");
    return { success: false, reason: "state_mismatch" };
  }

  if (!params.code) {
    return { success: false, reason: "exchange_failed" };
  }

  let identity;
  try {
    identity = await exchangeGoogleAuthorizationCode({
      code: params.code,
      codeVerifier: consumed.codeVerifier,
      redirectUri: params.redirectUri,
    });
  } catch {
    return { success: false, reason: "exchange_failed" };
  }

  if (identity.emailVerified !== true) {
    return { success: false, reason: "email_not_verified" };
  }

  const existingOauthAccount = await findOauthAccountByProviderSub("google", identity.sub);

  let userId: string;
  if (existingOauthAccount) {
    userId = existingOauthAccount.userId;
  } else {
    const existingUser = await findUserByEmail(identity.email);
    if (!existingUser) {
      const timezone =
        params.timezone && isValidTimezone(params.timezone) ? params.timezone : "UTC";
      const created = await createUserWithOauth({
        email: identity.email,
        timezone,
        fullName: identity.name ?? "",
        provider: "google",
        providerUserId: identity.sub,
        periodStart: currentMonthStart(),
      });
      userId = created.userId;
      await logSecurityEvent("oauth_linked", {
        userId,
        metadata: { provider: "google", newAccount: true },
      });
    } else if (existingUser.emailVerifiedAt) {
      await linkOauthAccount({
        userId: existingUser.id,
        provider: "google",
        providerUserId: identity.sub,
      });
      userId = existingUser.id;
      await logSecurityEvent("oauth_linked", {
        userId,
        metadata: { provider: "google", newAccount: false },
      });
    } else {
      await linkOauthAndInvalidatePassword({
        userId: existingUser.id,
        provider: "google",
        providerUserId: identity.sub,
      });
      userId = existingUser.id;
      await logSecurityEvent("password_invalidated_by_oauth_link", { userId });
    }
  }

  const session = await issueSession(userId);
  return { success: true, rawToken: session.rawToken, expiresAt: session.expiresAt };
}
