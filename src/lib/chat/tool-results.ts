import type { MeetingProposalData } from '@/components/MeetingPreviewCard';
import type { UpcomingEventItem } from '@/lib/calendar/types';

export type ParsedUpcomingEventsResult =
  | { status: 'ok'; events: UpcomingEventItem[]; isMock: boolean; note?: string }
  | { status: 'error'; error: string }
  | { status: 'invalid' };

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks whether an unknown value is a non-null, non-array plain object record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes a persisted or streamed `proposeMeeting` tool result.
 * Returns `null` when required fields are missing or malformed so callers can render
 * a safe fallback instead of crashing.
 */
export function parseMeetingProposalResult(value: unknown): MeetingProposalData | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.proposalId !== 'string' ||
    value.proposalId.trim().length === 0 ||
    typeof value.summary !== 'string' ||
    value.summary.trim().length === 0 ||
    typeof value.startDateTime !== 'string' ||
    value.startDateTime.trim().length === 0 ||
    !Number.isFinite(Date.parse(value.startDateTime)) ||
    typeof value.endDateTime !== 'string' ||
    value.endDateTime.trim().length === 0 ||
    !Number.isFinite(Date.parse(value.endDateTime))
  ) {
    return null;
  }

  if (value.description !== undefined && typeof value.description !== 'string') {
    return null;
  }
  if (value.timeZone !== undefined && typeof value.timeZone !== 'string') {
    return null;
  }
  if (value.createMeet !== undefined && typeof value.createMeet !== 'boolean') {
    return null;
  }

  let attendees: Array<{ email: string; name?: string }> | undefined;
  if (value.attendees !== undefined) {
    if (!Array.isArray(value.attendees)) return null;
    attendees = [];
    for (const item of value.attendees) {
      if (
        !isRecord(item) ||
        typeof item.email !== 'string' ||
        item.email.trim().length === 0 ||
        (item.name !== undefined && typeof item.name !== 'string')
      ) {
        return null;
      }
      attendees.push({
        email: item.email,
        ...(item.name !== undefined ? { name: item.name } : {}),
      });
    }
  }

  let reminderMinutes: number[] | undefined;
  if (value.reminderMinutes !== undefined) {
    if (
      !Array.isArray(value.reminderMinutes) ||
      value.reminderMinutes.some(
        (minutes) =>
          typeof minutes !== 'number' ||
          !Number.isInteger(minutes) ||
          minutes < 0 ||
          minutes > 40320
      )
    ) {
      return null;
    }
    reminderMinutes = [...value.reminderMinutes];
  }

  return {
    proposalId: value.proposalId,
    summary: value.summary,
    startDateTime: value.startDateTime,
    endDateTime: value.endDateTime,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.timeZone !== undefined ? { timeZone: value.timeZone } : {}),
    ...(attendees !== undefined ? { attendees } : {}),
    ...(value.createMeet !== undefined ? { createMeet: value.createMeet } : {}),
    ...(reminderMinutes !== undefined ? { reminderMinutes } : {}),
  };
}

function parseUpcomingEventItem(value: unknown): UpcomingEventItem | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    typeof value.summary !== 'string' ||
    value.summary.trim().length === 0 ||
    typeof value.start !== 'string' ||
    value.start.trim().length === 0 ||
    !Number.isFinite(Date.parse(value.start))
  ) {
    return null;
  }

  if (
    value.end !== undefined &&
    (typeof value.end !== 'string' || (value.end !== '' && !Number.isFinite(Date.parse(value.end))))
  ) {
    return null;
  }
  if (value.isAllDay !== undefined && typeof value.isAllDay !== 'boolean') {
    return null;
  }
  if (value.htmlLink !== undefined && typeof value.htmlLink !== 'string') {
    return null;
  }
  if (value.hangoutLink !== undefined && typeof value.hangoutLink !== 'string') {
    return null;
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    return null;
  }

  const isAllDay =
    value.isAllDay === true ||
    (value.isAllDay === undefined && DATE_ONLY_PATTERN.test(value.start.trim()));
  const rawEnd = typeof value.end === 'string' ? value.end : '';
  const end = rawEnd || (isAllDay ? '' : value.start);
  const htmlLink = typeof value.htmlLink === 'string' ? value.htmlLink : '';

  return {
    id: value.id,
    summary: value.summary,
    start: value.start,
    end,
    htmlLink,
    isAllDay,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.hangoutLink !== undefined ? { hangoutLink: value.hangoutLink } : {}),
  };
}

/**
 * Validates and normalizes a `listUpcomingEvents` tool invocation result.
 */
export function parseUpcomingEventsResult(value: unknown): ParsedUpcomingEventsResult {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    return { status: 'invalid' };
  }

  if (value.success === false) {
    const error =
      typeof value.error === 'string' && value.error.trim().length > 0
        ? value.error
        : 'Không thể lấy danh sách sự kiện.';
    return { status: 'error', error };
  }

  if (!Array.isArray(value.events)) {
    return { status: 'invalid' };
  }

  const events: UpcomingEventItem[] = [];
  for (const item of value.events) {
    const parsed = parseUpcomingEventItem(item);
    if (!parsed) {
      return { status: 'invalid' };
    }
    events.push(parsed);
  }

  const isMock = value.isMock === true || value.mode === 'mock';
  const note =
    typeof value.note === 'string' && value.note.trim().length > 0 ? value.note : undefined;

  return { status: 'ok', events, isMock, note };
}

function getLookupRangeKind(args: unknown): 'today' | 'this_week' | 'custom' | 'upcoming' {
  if (!isRecord(args)) return 'upcoming';
  if (args.range === 'today') return 'today';
  if (args.range === 'this_week') return 'this_week';
  if (typeof args.timeMin === 'string' && typeof args.timeMax === 'string') return 'custom';
  return 'upcoming';
}

/**
 * Returns the localized Vietnamese heading for a `listUpcomingEvents` card.
 */
export function getUpcomingEventsHeading(args: unknown, isMock: boolean): string {
  const kind = getLookupRangeKind(args);
  if (isMock) {
    switch (kind) {
      case 'today':
        return 'Sự kiện hôm nay (Lịch mẫu):';
      case 'this_week':
        return 'Sự kiện tuần này (Lịch mẫu):';
      case 'custom':
        return 'Sự kiện trong khoảng thời gian đã chọn (Lịch mẫu):';
      case 'upcoming':
        return 'Sự kiện sắp diễn ra (Lịch mẫu):';
    }
  }

  switch (kind) {
    case 'today':
      return 'Sự kiện hôm nay trên Google Calendar:';
    case 'this_week':
      return 'Sự kiện tuần này trên Google Calendar:';
    case 'custom':
      return 'Sự kiện trên Google Calendar:';
    case 'upcoming':
      return 'Sự kiện sắp diễn ra trên Google Calendar:';
  }
}

/**
 * Returns the localized Vietnamese empty-state copy for a `listUpcomingEvents` card.
 */
export function getUpcomingEventsEmptyMessage(args: unknown): string {
  switch (getLookupRangeKind(args)) {
    case 'today':
      return 'Không có sự kiện nào trong hôm nay.';
    case 'this_week':
      return 'Không có sự kiện nào trong tuần này.';
    case 'custom':
      return 'Không có sự kiện nào trong khoảng thời gian này.';
    case 'upcoming':
      return 'Không có sự kiện nào sắp tới trong khoảng thời gian này.';
  }
}
