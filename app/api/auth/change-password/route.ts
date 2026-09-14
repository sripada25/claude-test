import { NextResponse } from "next/server";
import { changePassword } from "@/lib/services/change-password";

const FAILURE_STATUS: Record<string, number> = {
  weak_password: 400,
  incorrect_current_password: 400,
  rate_limited: 429,
};

export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : undefined;

  if (!newPassword) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await changePassword(userId, { currentPassword, newPassword });

  if (!result.success) {
    return NextResponse.json(result, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json(result);
}
