import { NextResponse } from "next/server";
import { getReminderQueue } from "@/lib/services/reminder";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const queue = await getReminderQueue(userId);
  return NextResponse.json(queue);
}
