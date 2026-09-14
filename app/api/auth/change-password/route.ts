import { NextResponse } from "next/server";
import { getSessionTokenFromRequest } from "@/lib/security/session-cookie";
import { changePassword } from "@/lib/services/change-password";
import { resolveSession } from "@/lib/services/session";

const FAILURE_STATUS: Record<string, number> = {
  weak_password: 400,
  incorrect_current_password: 400,
  rate_limited: 429,
};

// M09-5: this route lives under /api/auth/, which proxy.ts treats as a
// public prefix - it never resolves a session or sets x-user-id there.
// Resolves its own session from the cookie instead, matching
// /api/auth/change-email's established pattern for the same reason.
export async function POST(request: Request): Promise<NextResponse> {
  const rawToken = getSessionTokenFromRequest(request);
  const resolved = rawToken ? await resolveSession(rawToken) : null;

  if (!resolved) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : undefined;

  if (!newPassword) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await changePassword(resolved.userId, { currentPassword, newPassword });

  if (!result.success) {
    return NextResponse.json(result, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json(result);
}
