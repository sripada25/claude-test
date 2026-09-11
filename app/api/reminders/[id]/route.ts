import { NextResponse } from "next/server";
import { dismissReminderFollowUp, snoozeReminderFollowUp } from "@/lib/services/reminder";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { id } = await params;

  if (body?.action === "dismiss") {
    const result = await dismissReminderFollowUp(userId, id);
    if (!result.success) {
      return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
    }
    return NextResponse.json({
      id: result.id,
      status: result.status,
      snoozedUntil: result.snoozedUntil,
      dismissedAt: result.dismissedAt,
    });
  }

  if (body?.action === "snooze") {
    const until = typeof body.until === "string" ? new Date(body.until) : null;
    if (!until || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      return NextResponse.json({ success: false, reason: "invalid_until" }, { status: 400 });
    }

    const result = await snoozeReminderFollowUp(userId, id, until);
    if (!result.success) {
      return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
    }
    return NextResponse.json({
      id: result.id,
      status: result.status,
      snoozedUntil: result.snoozedUntil,
      dismissedAt: result.dismissedAt,
    });
  }

  return NextResponse.json({ success: false, reason: "invalid_action" }, { status: 400 });
}
