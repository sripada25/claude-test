import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/repositories/user";
import { getAccountSummary, updateNotificationPreferences } from "@/lib/services/account";
import { SESSION_COOKIE_NAME, clearedSessionCookieOptions } from "@/lib/security/session-cookie";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const summary = await getAccountSummary(userId);
  if (!summary) {
    return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.reminderEmailsEnabled !== "boolean") {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  await updateNotificationPreferences(userId, { reminderEmailsEnabled: body.reminderEmailsEnabled });

  const summary = await getAccountSummary(userId);
  if (!summary) {
    return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  await deleteUser(userId);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}
