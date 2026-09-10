import { NextResponse } from "next/server";
import { updateDocumentContent } from "@/lib/services/document";

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
  const result = await updateDocumentContent(userId, id, body.content);

  if (!result.success) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ success: false, reason: result.reason }, { status });
  }

  return NextResponse.json(result.document);
}
