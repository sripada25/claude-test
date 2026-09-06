import { countFailedAttempts, insertAttempt } from "../repositories/auth-attempt.ts";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MINUTES = 15;

export async function checkRateLimit(
  identifier: string,
  options: { maxAttempts?: number; windowMinutes?: number } = {},
): Promise<{ allowed: boolean }> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMinutes = options.windowMinutes ?? DEFAULT_WINDOW_MINUTES;

  try {
    const failedCount = await countFailedAttempts(identifier, windowMinutes);
    return { allowed: failedCount < maxAttempts };
  } catch {
    // "Rate limiter unavailable => deny the attempt" (SECURITY_quarterfinal.md).
    return { allowed: false };
  }
}

export async function recordAttempt(identifier: string, succeeded: boolean): Promise<void> {
  await insertAttempt(identifier, succeeded);
}
