import { NextResponse } from "next/server";
import { confirmContactEmailOtp } from "@/lib/services/profile";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;

  if (!code) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await confirmContactEmailOtp(userId, code);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
