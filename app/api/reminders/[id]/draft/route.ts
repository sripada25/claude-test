import { NextResponse } from "next/server";
import { draftReminderFollowUp } from "@/lib/services/reminder";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  ai_failed: 502,
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
  const result = await draftReminderFollowUp(userId, id);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json({ draftContent: result.draftContent });
}
