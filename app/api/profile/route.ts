import { NextResponse } from "next/server";
import { getProfile, updateProfile, type ProfilePatch } from "@/lib/services/profile";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const profile = await getProfile(userId);
  return NextResponse.json(profile);
}

export async function PUT(request: Request): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const patch: ProfilePatch = {};
  if (typeof body?.fullName === "string") patch.fullName = body.fullName;
  if (body?.currentRole === null || typeof body?.currentRole === "string") {
    patch.currentRole = body.currentRole;
  }
  if (body?.targetRole === null || typeof body?.targetRole === "string") {
    patch.targetRole = body.targetRole;
  }
  if (body?.contactEmail === null || typeof body?.contactEmail === "string") {
    patch.contactEmail = body.contactEmail;
  }
  if (body?.yearsExperience === null || typeof body?.yearsExperience === "number") {
    patch.yearsExperience = body.yearsExperience;
  }
  if (body?.monthsExperience === null || typeof body?.monthsExperience === "number") {
    patch.monthsExperience = body.monthsExperience;
  }
  if (Array.isArray(body?.skills) && body.skills.every((s: unknown) => typeof s === "string")) {
    patch.skills = body.skills;
  }
  if (body?.salaryAmount === null || typeof body?.salaryAmount === "number") {
    patch.salaryAmount = body.salaryAmount;
  }
  if (body?.salaryCurrency === null || typeof body?.salaryCurrency === "string") {
    patch.salaryCurrency = body.salaryCurrency;
  }
  if (body?.salaryPeriod === null || body?.salaryPeriod === "monthly" || body?.salaryPeriod === "annual") {
    patch.salaryPeriod = body.salaryPeriod;
  }
  if (
    body?.locationPreference === null ||
    body?.locationPreference === "remote" ||
    body?.locationPreference === "hybrid" ||
    body?.locationPreference === "onsite"
  ) {
    patch.locationPreference = body.locationPreference;
  }

  const result = await updateProfile(userId, patch);
  if (!result.success) {
    return NextResponse.json({ success: false, reason: result.reason }, { status: 400 });
  }

  return NextResponse.json(result.profile);
}
