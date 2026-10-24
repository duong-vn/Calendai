import { formatDateTime } from './AgendaCard';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

it('does not throw for invalid dates and keeps timezone fallback for valid dates', () => {
  expect(formatDateTime('invalid')).toBe('invalid');
  expect(formatDateTime('')).toBe('');
  const input = '2027-01-02T09:00:00+07:00';
  expect(formatDateTime(input, 'Invalid/Zone')).toBe(formatDateTime(input, 'Asia/Ho_Chi_Minh'));
});
