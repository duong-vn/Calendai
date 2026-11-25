import { CalendarConflictError, MobileApi } from './api';
import { ApiError } from './transport';
import { parseEvent, parseProposal } from '../types';
import { safeHttpsUrl } from './links';

jest.mock('./auth', () => ({ authClient: { fetch: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const event = { id: 'event-a', summary: 'Họp nhóm', start: '2027-01-02T09:00:00+07:00', end: '2027-01-02T10:00:00+07:00' };
const draft = { proposalId: 'stable-proposal-id', summary: 'Họp nhóm', startDateTime: event.start, endDateTime: event.end, timeZone: 'Asia/Ho_Chi_Minh', attendees: [{ email: 'ban@example.com' }], createMeet: true };
const response = (value: unknown, status = 200) => ({ ok: status < 300, status, json: async () => value }) as Response;

it('sends the canonical stable proposal and accepts only real calendar success', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ success: true, event }));
  const api = new MobileApi(fetcher);
  expect(await api.confirm(draft)).toMatchObject(event);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ ...draft, allowConflict: false });
  fetcher.mockResolvedValue(response({ success: true, isMock: true, event }));
  await expect(api.confirm(draft)).rejects.toThrow('Chưa xác nhận');
});
it.each([{ minutes: [60, 10] }, { minutes: [] }, { minutes: [0, 40320, 30, 15, 5] }])('preserves explicit reminders through parsing and confirmation (%j)', async ({ minutes }) => {
  const fetcher = jest.fn().mockResolvedValue(response({ success: true, event }));
  const proposal = { ...draft, reminderMinutes: minutes };
  expect(parseProposal(proposal)).toEqual(proposal);
  await new MobileApi(fetcher).confirm(proposal);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ ...proposal, allowConflict: false });
});
it.each([{ minutes: null }, { minutes: [1, 1] }, { minutes: [-1] }, { minutes: [40321] }, { minutes: [1.5] }, { minutes: ['10'] }, { minutes: [NaN] }, { minutes: [1, 2, 3, 4, 5, 6] }])('rejects invalid reminders before a network side effect (%j)', async ({ minutes }) => {
  const fetcher = jest.fn();
  await expect(new MobileApi(fetcher).confirm({ ...draft, reminderMinutes: minutes } as unknown as Parameters<MobileApi['confirm']>[0])).rejects.toThrow('mốc nhắc');
  expect(fetcher).not.toHaveBeenCalled();
});
it('surfaces conflicts without claiming creation and only overrides after explicit choice', async () => {
  const conflict = { id: 'old', summary: 'Họp cũ', start: event.start, end: event.end, etag: 'v1', timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false };
  const fetcher = jest.fn().mockResolvedValue(response({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [conflict] }, 409));
  const api = new MobileApi(fetcher);
  await expect(api.confirm(draft)).rejects.toBeInstanceOf(CalendarConflictError);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).allowConflict).toBe(false);
  fetcher.mockResolvedValue(response({ success: true, event }));
  await expect(api.confirm(draft, undefined, true)).resolves.toMatchObject(event);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).allowConflict).toBe(true);
});
it('does not represent failed auth/upcoming as an empty calendar', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ error: 'unauthorized' }, 401));
  await expect(new MobileApi(fetcher).upcoming()).rejects.toThrow('đăng nhập');
  fetcher.mockResolvedValue(response({ success: true, mode: 'mock', events: [] }));
  await expect(new MobileApi(fetcher).upcoming()).rejects.toThrow('lịch thật');
});
it('preserves the canonical pending/failed conference status separately from event success', () => {
  expect(parseEvent({ ...event, conferenceStatus: 'pending' }).meetStatus).toBe('pending');
  expect(parseEvent({ ...event, conferenceStatus: 'failure' }).meetStatus).toBe('failure');
});
it('validates proposals and external links', () => {
  expect(() => parseProposal({ ...draft, endDateTime: draft.startDateTime })).toThrow();
  expect(() => parseProposal({ ...draft, attendees: [{ email: 'not-email' }] })).toThrow();
  expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
  expect(safeHttpsUrl('https://meet.google.com.evil.test/path', 'meet')).toBeNull();
  expect(safeHttpsUrl('https://user:pass@meet.google.com/path', 'meet')).toBeNull();
  expect(safeHttpsUrl('https://meet.google.com/abc-defg-hij', 'meet')).toBe('https://meet.google.com/abc-defg-hij');
});
it('classifies 400/401 rejections as ApiError and ignores empty conflict lists', async () => {
  const fetcher = jest.fn()
    .mockResolvedValueOnce(response({ success: false, error: 'Bad request' }, 400))
    .mockResolvedValueOnce(response({ code: 'AUTH_REQUIRED', error: 'Unauthorized' }, 401))
    .mockResolvedValueOnce(response({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [] }, 409))
    .mockResolvedValueOnce(response({ success: false, code: 'PROPOSAL_CONFLICT', error: 'Conflict' }, 409));
  const api = new MobileApi(fetcher);
  const first = api.confirm(draft);
  await expect(first).rejects.toBeInstanceOf(ApiError);
  await expect(first).rejects.toMatchObject({ status: 400 });
  const second = api.confirm(draft);
  await expect(second).rejects.toBeInstanceOf(ApiError);
  await expect(second).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
  await expect(api.confirm(draft)).rejects.not.toBeInstanceOf(CalendarConflictError);
  await expect(api.confirm(draft)).rejects.not.toBeInstanceOf(ApiError);
});

it('classifies resolveConflict 409 CALENDAR_CONFLICT vs 409 STALE_EVENT, 400 recurring/invalid, 401, and 502 safely', async () => {
  const conflict = { id: 'old', summary: 'Họp cũ', start: event.start, end: event.end, etag: '"v1"', timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false };
  const thirdConflict = { ...conflict, id: 'third', summary: 'Họp khác' };
  const times = { startDateTime: '2027-01-02T14:00:00+07:00', endDateTime: '2027-01-02T15:00:00+07:00' };

  const fetcher = jest.fn()
    .mockResolvedValueOnce(response({ success: true }, 200))
    .mockResolvedValueOnce(response({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [conflict] }, 409))
    .mockResolvedValueOnce(response({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [thirdConflict], error: 'raw-google-overlap' }, 409))
    .mockResolvedValueOnce(response({ success: false, code: 'STALE_EVENT', error: 'Sự kiện đã thay đổi.' }, 409))
    .mockResolvedValueOnce(response({ success: false, error: 'Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.' }, 400))
    .mockResolvedValueOnce(response({ success: false, error: 'private-schema-detail-secret' }, 400))
    .mockResolvedValueOnce(response({ code: 'AUTH_REQUIRED', error: 'private-auth-detail' }, 401))
    .mockResolvedValueOnce(response({ success: false, error: 'upstream-502-secret' }, 502));

  const api = new MobileApi(fetcher);
  await expect(api.resolveConflict(draft, conflict, 'reschedule', times)).resolves.toBeUndefined();

  const draftOverlap = api.resolveConflict(draft, conflict, 'reschedule', times);
  await expect(draftOverlap).rejects.toBeInstanceOf(CalendarConflictError);
  await expect(draftOverlap).rejects.toThrow(/bản thảo/);

  const otherOverlap = api.resolveConflict(draft, conflict, 'reschedule', times);
  await expect(otherOverlap).rejects.toBeInstanceOf(CalendarConflictError);
  await expect(otherOverlap).rejects.not.toThrow('raw-google-overlap');

  const stale = api.resolveConflict(draft, conflict, 'cancel');
  await expect(stale).rejects.toBeInstanceOf(ApiError);
  await expect(stale).rejects.toMatchObject({ status: 409, code: 'STALE_EVENT' });

  const recurring = api.resolveConflict(draft, conflict, 'cancel');
  await expect(recurring).rejects.toBeInstanceOf(ApiError);
  await expect(recurring).rejects.toMatchObject({ status: 400, code: 'RECURRING_EVENT' });
  await expect(recurring).rejects.toThrow('Không thể thay đổi cả chuỗi sự kiện');

  const invalid = api.resolveConflict(draft, conflict, 'reschedule', times);
  await expect(invalid).rejects.toBeInstanceOf(ApiError);
  await expect(invalid).rejects.toMatchObject({ status: 400, code: 'INVALID_INPUT' });
  await expect(invalid).rejects.not.toThrow('private-schema-detail-secret');

  const unauth = api.resolveConflict(draft, conflict, 'cancel');
  await expect(unauth).rejects.toBeInstanceOf(ApiError);
  await expect(unauth).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
  await expect(unauth).rejects.not.toThrow('private-auth-detail');

  const gateway = api.resolveConflict(draft, conflict, 'cancel');
  await expect(gateway).rejects.toBeInstanceOf(ApiError);
  await expect(gateway).rejects.toMatchObject({ status: 502 });
  await expect(gateway).rejects.not.toThrow('upstream-502-secret');
});
