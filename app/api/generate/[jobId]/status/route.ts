import { NextResponse } from "next/server";
import { getGenerationStatus } from "@/lib/services/generation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const result = await getGenerationStatus(userId, jobId);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 404 });
  }

  if (result.status === "succeeded") {
    return NextResponse.json({ status: result.status, document: result.document });
  }
  if (result.status === "failed") {
    return NextResponse.json({ status: result.status, errorClass: result.errorClass });
  }
  return NextResponse.json({ status: result.status });
}
