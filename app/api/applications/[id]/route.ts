import { NextResponse } from "next/server";
import { getApplication } from "@/lib/services/application";

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
