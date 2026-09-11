import { NextResponse } from "next/server";
import { draftReminderFollowUp, updateReminderDraftContent } from "@/lib/services/reminder";

const POST_FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  ai_failed: 502,
};

const PATCH_FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  empty_content: 400,
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
    return NextResponse.json(
      { success: false, reason: result.reason },
      { status: POST_FAILURE_STATUS[result.reason] },
    );
  }

  return NextResponse.json({ draftContent: result.draftContent });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const result = await updateReminderDraftContent(userId, id, body.content);

  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason },
      { status: PATCH_FAILURE_STATUS[result.reason] },
    );
  }

  return NextResponse.json({ draftContent: result.draftContent });
}
