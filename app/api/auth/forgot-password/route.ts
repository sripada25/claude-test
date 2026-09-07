import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/services/forgot-password";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await requestPasswordReset(email);

  if (!result.success) {
    return NextResponse.json(result, { status: 429 });
  }

  return NextResponse.json(result);
}
