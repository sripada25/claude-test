import { NextResponse } from "next/server";
import { parseResume } from "@/lib/services/resume-parse";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("resume");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, reason: "missing_file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseResume({ buffer, mimeType: file.type });

  if (!result.success) {
    const status = result.error.errorClass === "bad_request" ? 400 : 200;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
