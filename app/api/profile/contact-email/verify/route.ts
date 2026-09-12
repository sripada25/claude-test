import { NextResponse } from "next/server";
import { issueContactEmailOtp } from "@/lib/services/profile";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await issueContactEmailOtp(userId);
  if (!result.success) {
    const status = result.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
