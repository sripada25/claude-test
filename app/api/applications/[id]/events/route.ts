import { NextResponse } from "next/server";
import { listApplicationEvents } from "@/lib/services/application-event";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const events = await listApplicationEvents(userId, id);

  return NextResponse.json(events);
}
