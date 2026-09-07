import { NextResponse } from "next/server";
import { getSessionTokenFromRequest } from "@/lib/security/session-cookie";
import { requestChangeEmail } from "@/lib/services/change-email";
import { resolveSession } from "@/lib/services/session";

export async function POST(request: Request): Promise<NextResponse> {
  const rawToken = getSessionTokenFromRequest(request);
  const resolved = rawToken ? await resolveSession(rawToken) : null;

  if (!resolved) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail : null;

  if (!newEmail) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await requestChangeEmail({ userId: resolved.userId, newEmail });

  if (!result.success) {
    const status = result.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
