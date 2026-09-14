import {
  findAccountForExport,
  findApplicationsForExport,
  findEmploymentHistoryForExport,
  findProfileForExport,
  findSubscriptionForExport,
  type ExportAccount,
  type ExportApplication,
  type ExportEmploymentEntry,
  type ExportProfile,
  type ExportSubscription,
} from "../repositories/data-export.ts";

export interface DataExport {
  exportedAt: string;
  account: ExportAccount;
  profile: ExportProfile | null;
  employmentHistory: ExportEmploymentEntry[];
  subscription: ExportSubscription | null;
  applications: ExportApplication[];
}

// M09-6: scope is everything DELETE /api/account also cascades away - the
// existing, authoritative definition of "belongs to this user" - minus
// Trackr's own operational/security tables (sessions, tokens, audit
// events, usage metering), which aren't personal data the user provided.
export async function buildDataExport(userId: string): Promise<DataExport | null> {
  const account = await findAccountForExport(userId);
  if (!account) {
    return null;
  }

  const [profile, employmentHistory, subscription, applications] = await Promise.all([
    findProfileForExport(userId),
    findEmploymentHistoryForExport(userId),
    findSubscriptionForExport(userId),
    findApplicationsForExport(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account,
    profile,
    employmentHistory,
    subscription,
    applications,
  };
}
