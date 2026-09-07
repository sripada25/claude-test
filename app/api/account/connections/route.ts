import { NextResponse } from "next/server";
import { listConnections, removeConnection } from "@/lib/services/oauth-connections";
import type { OauthProvider } from "@/lib/repositories/oauth-state";

const VALID_PROVIDERS: OauthProvider[] = ["google", "linkedin"];

function isOauthProvider(value: string | null): value is OauthProvider {
  return value !== null && (VALID_PROVIDERS as string[]).includes(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const { connections, hasPassword } = await listConnections(userId);
  return NextResponse.json({ connections, hasPassword });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const provider = new URL(request.url).searchParams.get("provider");
  if (!isOauthProvider(provider)) {
    return NextResponse.json({ success: false, reason: "invalid_provider" }, { status: 400 });
  }

  const result = await removeConnection(userId, provider);
  if (!result.success) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ success: true });
}
