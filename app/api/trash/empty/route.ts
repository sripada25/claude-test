import { NextResponse } from "next/server";
import { emptyTrash } from "@/lib/services/application";

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await emptyTrash(userId);
  return NextResponse.json(result);
}
