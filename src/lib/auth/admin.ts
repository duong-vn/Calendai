import type { SessionData } from './types';

/**
 * Parses comma-separated admin email addresses from env.
 */
export function parseAdminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks whether an email address is authorized as an admin.
 */
export function isAdminEmail(
  email?: string | null,
  rawAdminEmails = process.env.ADMIN_EMAILS
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails(rawAdminEmails).includes(normalized);
}

/**
 * Checks whether the current authenticated session belongs to an admin user.
 */
export function isAdminSession(
  session: SessionData | null,
  rawAdminEmails = process.env.ADMIN_EMAILS
): boolean {
  return Boolean(session && isAdminEmail(session.user?.email, rawAdminEmails));
}
