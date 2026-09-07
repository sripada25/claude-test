import { NextResponse } from "next/server";
import { getSubscription } from "@/lib/services/subscription";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await getSubscription(userId);
    return NextResponse.json(subscription);
  } catch {
    return NextResponse.json({ success: false, reason: "internal_error" }, { status: 500 });
  }
}
