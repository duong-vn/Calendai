import { z } from 'zod';

export const DEFAULT_REMINDER_MINUTES = [60, 10];
export const REMINDER_SETTINGS_KEY = 'calendai_reminder_minutes';
export const ReminderMinutesSchema = z.array(z.number().int().min(0).max(40320)).max(5)
  .refine(values => new Set(values).size === values.length, 'Các mốc nhắc không được trùng nhau.');

// shortcut: preferences are device-local; add account sync when cross-device settings are needed.
export function readReminderSettings(): number[] {
  try {
    const saved = localStorage.getItem(REMINDER_SETTINGS_KEY);
    const result = ReminderMinutesSchema.safeParse(saved === null ? DEFAULT_REMINDER_MINUTES : JSON.parse(saved));
    return result.success ? result.data : [...DEFAULT_REMINDER_MINUTES];
  } catch { return [...DEFAULT_REMINDER_MINUTES]; }
}
