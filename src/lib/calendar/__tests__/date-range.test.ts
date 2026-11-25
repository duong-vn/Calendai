import { describe, expect, it } from 'vitest';
import {
  VIETNAM_TIME_ZONE,
  getVietnamThisWeekRange,
  getVietnamTodayRange,
  isEventInTimeRange,
} from '../date-range';

describe('Vietnam Calendar Date Ranges (Asia/Ho_Chi_Minh)', () => {
  it('computes today range across Vietnam evening, early morning, year-end, and leap day', () => {
    // 20:00 on 2026-11-11 GMT+7
    expect(getVietnamTodayRange(new Date('2026-11-11T13:00:00Z'))).toEqual({
      timeMin: '2026-11-11T00:00:00+07:00',
      timeMax: '2026-11-12T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // 00:15 on 2026-11-12 GMT+7 (still 2026-11-11 17:15 UTC)
    expect(getVietnamTodayRange(new Date('2026-11-11T17:15:00Z'))).toEqual({
      timeMin: '2026-11-12T00:00:00+07:00',
      timeMax: '2026-11-13T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // 23:30 on 2026-12-31 GMT+7 (year boundary)
    expect(getVietnamTodayRange(new Date('2026-12-31T16:30:00Z'))).toEqual({
      timeMin: '2026-12-31T00:00:00+07:00',
      timeMax: '2027-01-01T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // 22:00 on 2028-02-28 GMT+7 (leap year)
    expect(getVietnamTodayRange(new Date('2028-02-28T15:00:00Z'))).toEqual({
      timeMin: '2028-02-28T00:00:00+07:00',
      timeMax: '2028-02-29T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });
  });

  it('computes Monday-Sunday week boundaries in Asia/Ho_Chi_Minh across week and year transitions', () => {
    // Wednesday 2026-11-11 20:00 GMT+7 -> Mon Nov 9 .. Mon Nov 16
    expect(getVietnamThisWeekRange(new Date('2026-11-11T13:00:00Z'))).toEqual({
      timeMin: '2026-11-09T00:00:00+07:00',
      timeMax: '2026-11-16T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // Sunday 2026-11-15 23:59 GMT+7 -> still Mon Nov 9 .. Mon Nov 16
    expect(getVietnamThisWeekRange(new Date('2026-11-15T16:59:00Z'))).toEqual({
      timeMin: '2026-11-09T00:00:00+07:00',
      timeMax: '2026-11-16T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // Monday 2026-11-16 00:00 GMT+7 (Sunday 17:00 UTC) -> Mon Nov 16 .. Mon Nov 23
    expect(getVietnamThisWeekRange(new Date('2026-11-15T17:00:00Z'))).toEqual({
      timeMin: '2026-11-16T00:00:00+07:00',
      timeMax: '2026-11-23T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });

    // Thursday 2026-12-31 22:00 GMT+7 -> Mon Dec 28, 2026 .. Mon Jan 4, 2027
    expect(getVietnamThisWeekRange(new Date('2026-12-31T15:00:00Z'))).toEqual({
      timeMin: '2026-12-28T00:00:00+07:00',
      timeMax: '2027-01-04T00:00:00+07:00',
      timeZone: VIETNAM_TIME_ZONE,
    });
  });

  it('filters timed and all-day events accurately against half-open [timeMin, timeMax) boundaries', () => {
    const timeMin = '2026-11-11T00:00:00+07:00';
    const timeMax = '2026-11-12T00:00:00+07:00';

    // Timed events
    expect(isEventInTimeRange({ start: '2026-11-10T23:00:00+07:00', end: '2026-11-11T00:00:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(false);
    expect(isEventInTimeRange({ start: '2026-11-10T23:00:00+07:00', end: '2026-11-11T00:30:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-11T09:00:00+07:00', end: '2026-11-11T10:00:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-11T23:30:00+07:00', end: '2026-11-12T00:30:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-12T00:00:00+07:00', end: '2026-11-12T01:00:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(false);

    // Zero-duration events at exact boundaries
    expect(isEventInTimeRange({ start: '2026-11-11T00:00:00+07:00', end: '2026-11-11T00:00:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-12T00:00:00+07:00', end: '2026-11-12T00:00:00+07:00', isAllDay: false }, timeMin, timeMax)).toBe(false);

    // All-day events in Vietnam timezone (including omitted-end 24h fallback mid-day)
    expect(isEventInTimeRange({ start: '2026-11-10', end: '2026-11-11', isAllDay: true }, timeMin, timeMax)).toBe(false);
    expect(isEventInTimeRange({ start: '2026-11-11', end: '2026-11-12', isAllDay: true }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-10', end: '2026-11-13', isAllDay: true }, timeMin, timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-12', end: '2026-11-13', isAllDay: true }, timeMin, timeMax)).toBe(false);
    expect(isEventInTimeRange({ start: '2026-11-11', end: '', isAllDay: true }, '2026-11-11T13:00:00+07:00', timeMax)).toBe(true);
    expect(isEventInTimeRange({ start: '2026-11-10', end: '', isAllDay: true }, '2026-11-11T00:00:00+07:00', timeMax)).toBe(false);
  });
});
