import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/repositories/user";
import { SESSION_COOKIE_NAME, clearedSessionCookieOptions } from "@/lib/security/session-cookie";

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
