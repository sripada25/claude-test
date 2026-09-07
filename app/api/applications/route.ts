import { NextResponse } from "next/server";
import { createApplication } from "@/lib/services/application";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const result = await createApplication(userId, {
    company: typeof body.company === "string" ? body.company : "",
    role: typeof body.role === "string" ? body.role : "",
    status: typeof body.status === "string" ? body.status : undefined,
    jobDescription:
      body.jobDescription === null || typeof body.jobDescription === "string"
        ? body.jobDescription
        : undefined,
    source: body.source === null || typeof body.source === "string" ? body.source : undefined,
    sourceUrl:
      body.sourceUrl === null || typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
    dateApplied:
      body.dateApplied === null || typeof body.dateApplied === "string"
        ? body.dateApplied
        : undefined,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 400 });
  }

  return NextResponse.json(result.application);
}
