import { NextResponse } from "next/server";
import { buildDataExport } from "@/lib/services/data-export";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const data = await buildDataExport(userId);
  if (!data) {
    return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="trackr-data-export.json"',
    },
  });
}
