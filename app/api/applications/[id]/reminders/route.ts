import { NextResponse } from "next/server";
import { createCustomReminder, listReminders } from "@/lib/services/reminder";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await listReminders(userId, id);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 404 });
  }

  return NextResponse.json(result.reminders);
}

const POST_FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  invalid_due_at: 400,
  already_active: 409,
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
  const dueAt = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
  if (!dueAt || Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ success: false, reason: "invalid_due_at" }, { status: 400 });
  }

  const { id } = await params;
  const result = await createCustomReminder(userId, id, dueAt);

  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason },
      { status: POST_FAILURE_STATUS[result.reason] },
    );
  }

  return NextResponse.json({ id: result.id, status: result.status, dueAt: result.dueAt });
}
