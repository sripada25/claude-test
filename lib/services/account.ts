import { findUserById, hasPasswordHash } from "../repositories/user.ts";

export interface AccountSummary {
  email: string;
  hasPassword: boolean;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary | null> {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  return { email: user.email, hasPassword: await hasPasswordHash(userId) };
}
