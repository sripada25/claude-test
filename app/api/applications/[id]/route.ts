import { NextResponse } from "next/server";
import { deleteApplication, getApplication, updateApplication } from "@/lib/services/application";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteApplication(userId, id);

  if (!result.success) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ success: false, reason: result.reason }, { status });
  }

  return NextResponse.json(result.application);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const result = await updateApplication(userId, id, {
    company: typeof body.company === "string" ? body.company : undefined,
    role: typeof body.role === "string" ? body.role : undefined,
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
    notes: body.notes === null || typeof body.notes === "string" ? body.notes : undefined,
  });

  if (!result.success) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ success: false, reason: result.reason }, { status });
  }

  return NextResponse.json(result.application);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const application = await getApplication(userId, id);

  if (!application) {
    return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json(application);
}
