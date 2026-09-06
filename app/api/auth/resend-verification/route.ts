import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/repositories/user";
import { canResend, issueOtp } from "@/lib/services/verification";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;

  if (!email) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Never reveal account existence - pretend the send happened.
    return NextResponse.json({ success: true });
  }

  const allowed = await canResend(user.id, "verify_email");
  if (!allowed) {
    return NextResponse.json({ success: false, reason: "rate_limited" }, { status: 429 });
  }

  await issueOtp(user.id, "verify_email", user.email);
  return NextResponse.json({ success: true });
}
