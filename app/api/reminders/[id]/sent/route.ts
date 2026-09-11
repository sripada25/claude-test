import { NextResponse } from "next/server";
import { markReminderFollowUpSent } from "@/lib/services/reminder";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await markReminderFollowUpSent(userId, id);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json({ id: result.id, status: result.status, sentAt: result.sentAt });
}
