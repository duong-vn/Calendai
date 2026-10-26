import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReminderSettings } from '../ReminderSettings';
import { readReminderSettings, REMINDER_SETTINGS_KEY } from '@/lib/calendar/reminders';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });
describe('Reminder settings', () => {
  it('defaults to one hour and ten minutes and saves custom values', () => {
    render(<ReminderSettings />);
    const inputs = screen.getAllByRole('spinbutton', { hidden: true });
    expect(inputs[0]).toHaveValue(60);
    expect(inputs[1]).toHaveValue(10);
    fireEvent.change(inputs[0], { target: { value: '30' } });
    fireEvent.click(screen.getByText('Lưu cài đặt'));
    expect(readReminderSettings()).toEqual([30, 10]);
  });
  it('can disable reminders and rejects duplicate or invalid settings', () => {
    render(<ReminderSettings />);
    fireEvent.change(screen.getAllByRole('spinbutton', { hidden: true })[0], { target: { value: '10' } });
    fireEvent.click(screen.getByText('Lưu cài đặt'));
    expect(localStorage.getItem(REMINDER_SETTINGS_KEY)).toBeNull();
    fireEvent.click(screen.getByLabelText('Bỏ mốc nhắc 2'));
    fireEvent.click(screen.getByLabelText('Bỏ mốc nhắc 1'));
    fireEvent.click(screen.getByText('Lưu cài đặt'));
    expect(readReminderSettings()).toEqual([]);
  });
});
