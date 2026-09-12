import { NextResponse } from "next/server";
import { logCall } from "@/lib/services/call-note";
import type { StructuredNote } from "@/lib/ai/types";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  invalid_input: 400,
};

// Whitelisted explicitly (CLAUDE.md section 5.5) - never spread the raw
// request body into what gets stored, even though it's client-editable
// review content rather than untouched AI output.
function sanitizeStructured(value: unknown): StructuredNote | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.summary !== "string") {
    return undefined;
  }
  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return {
    summary: raw.summary,
    salaryMentioned: asStringOrNull(raw.salaryMentioned),
    contactName: asStringOrNull(raw.contactName),
    contactRole: asStringOrNull(raw.contactRole),
    nextStep: asStringOrNull(raw.nextStep),
    followUpDate: asStringOrNull(raw.followUpDate),
  };
}

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
  const result = await logCall(userId, id, {
    question1Answer: body.question1Answer,
    question2Answer: body.question2Answer,
    question3Answer: body.question3Answer,
    structured: sanitizeStructured(body.structured),
  });

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json({ success: true });
}
