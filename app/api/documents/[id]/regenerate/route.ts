import { NextResponse } from "next/server";
import { regenerateDocument } from "@/lib/services/generation";

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  no_job_description: 400,
  email_not_verified: 403,
  profile_incomplete: 403,
  queue_depth_exceeded: 403,
  quota_exhausted: 403,
  not_implemented: 403,
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
  const result = await regenerateDocument(userId, id);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: FAILURE_STATUS[result.reason] });
  }

  return NextResponse.json({ jobId: result.jobId, status: "queued" }, { status: 202 });
}
