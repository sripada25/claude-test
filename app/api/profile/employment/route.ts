import { NextResponse } from "next/server";
import {
  listEmploymentHistory,
  replaceEmploymentHistoryForUser,
  type EmploymentEntryInput,
} from "@/lib/services/employment-history";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const entries = await listEmploymentHistory(userId);
  return NextResponse.json(entries);
}

export async function PUT(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.entries)) {
    return NextResponse.json({ success: false, reason: "invalid_body" }, { status: 400 });
  }

  const entries: EmploymentEntryInput[] = body.entries.map(
    (entry: { employer?: unknown; title?: unknown; startDate?: unknown; endDate?: unknown }) => ({
      employer: typeof entry?.employer === "string" ? entry.employer : "",
      title: typeof entry?.title === "string" ? entry.title : "",
      startDate: typeof entry?.startDate === "string" ? entry.startDate : "",
      endDate: entry?.endDate === null || typeof entry?.endDate === "string" ? entry.endDate : null,
    }),
  );

  const result = await replaceEmploymentHistoryForUser(userId, entries);
  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 400 });
  }

  return NextResponse.json(result.entries);
}
