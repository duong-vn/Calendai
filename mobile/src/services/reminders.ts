import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REMINDER_MINUTES, parseReminderMinutes } from '../types';
const reminderKey = 'calendai.reminders.v1';

export async function loadReminderMinutes(): Promise<number[]> {
  const saved = await AsyncStorage.getItem(reminderKey);
  return saved === null ? [...DEFAULT_REMINDER_MINUTES] : parseReminderMinutes(JSON.parse(saved));
}

export async function saveReminderMinutes(minutes: number[]): Promise<void> {
  await AsyncStorage.setItem(reminderKey, JSON.stringify(parseReminderMinutes(minutes)));
}
