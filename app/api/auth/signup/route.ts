import { NextResponse } from "next/server";
import { signup } from "@/lib/services/signup";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;
  const timezone = typeof body?.timezone === "string" ? body.timezone : null;

  if (!email || !password || !timezone) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await signup({ email, password, timezone });

  if (!result.success) {
    const status = result.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
