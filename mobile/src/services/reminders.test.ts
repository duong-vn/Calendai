import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadReminderMinutes, saveReminderMinutes } from './reminders';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it('defaults to 60 and 10 minutes, persists custom settings and preserves explicit disable', async () => {
  expect(await loadReminderMinutes()).toEqual([60, 10]);
  await saveReminderMinutes([90, 0]);
  expect(await loadReminderMinutes()).toEqual([90, 0]);
  await saveReminderMinutes([]);
  expect(await loadReminderMinutes()).toEqual([]);
});

it('rejects corrupted saved settings without overwriting them', async () => {
  await saveReminderMinutes([30]);
  const key = jest.mocked(AsyncStorage.setItem).mock.calls[0][0];
  await AsyncStorage.setItem(key, '[10,10]');
  jest.clearAllMocks();
  await expect(loadReminderMinutes()).rejects.toThrow('mốc nhắc');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('propagates storage write failures', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Đầy bộ nhớ'));
  await expect(saveReminderMinutes([])).rejects.toThrow('Đầy bộ nhớ');
});
