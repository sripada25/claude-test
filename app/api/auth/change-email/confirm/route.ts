import { NextResponse } from "next/server";
import { getSessionTokenFromRequest } from "@/lib/security/session-cookie";
import { confirmChangeEmail } from "@/lib/services/change-email";
import { resolveSession } from "@/lib/services/session";

export async function POST(request: Request): Promise<NextResponse> {
  const rawToken = getSessionTokenFromRequest(request);
  const resolved = rawToken ? await resolveSession(rawToken) : null;

  if (!resolved) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;

  if (!code) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await confirmChangeEmail(resolved.userId, code);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
