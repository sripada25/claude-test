import { NextResponse } from "next/server";
import { sendReminderFollowUp } from "@/lib/services/reminder";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  not_pro: 403,
  no_recipient: 400,
  contact_email_unverified: 400,
  quota_exceeded: 503,
  send_failed: 502,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === "string" && body.subject.trim() !== "" ? body.subject : null;
  if (!subject) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const { id } = await params;
  const result = await sendReminderFollowUp(userId, id, subject);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json({
    id: result.id,
    status: result.status,
    sentAt: result.sentAt,
    recipientEmail: result.recipientEmail,
  });
}
