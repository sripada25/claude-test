import { NextResponse } from "next/server";
import { listDocuments } from "@/lib/services/document";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await listDocuments(userId, id);

  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 404 });
  }

  return NextResponse.json(result.documents);
}
