import { NextResponse } from "next/server";
import { structureCall } from "@/lib/services/call-note";

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

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.question1Answer !== "string" ||
    typeof body.question2Answer !== "string" ||
    typeof body.question3Answer !== "string"
  ) {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const result = await structureCall(userId, id, {
    question1Answer: body.question1Answer,
    question2Answer: body.question2Answer,
    question3Answer: body.question3Answer,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json(result.note);
}
