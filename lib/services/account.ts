import { findUserById, hasPasswordHash, updateReminderEmailsEnabled } from "../repositories/user.ts";

export interface AccountSummary {
  email: string;
  hasPassword: boolean;
  reminderEmailsEnabled: boolean;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary | null> {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  return {
    email: user.email,
    hasPassword: await hasPasswordHash(userId),
    reminderEmailsEnabled: user.reminderEmailsEnabled,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  patch: { reminderEmailsEnabled: boolean },
): Promise<void> {
  await updateReminderEmailsEnabled(userId, patch.reminderEmailsEnabled);
}
