import React from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CalendarConflictChoices } from './CalendarConflictChoices';
import { Action, Copy } from '../theme';
import { CalendarConflictError, mobileApi } from '../services/api';
import { ApiError } from '../services/transport';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../services/api', () => ({
  CalendarConflictError: class extends Error {
    readonly conflicts: unknown[];
    constructor(conflicts: unknown[], message = 'Khung giờ này trùng với lịch có sẵn.') {
      super(message);
      this.conflicts = conflicts;
    }
  },
  mobileApi: { resolveConflict: jest.fn() },
}));

const proposal = { proposalId: 'new', summary: 'Họp mới', startDateTime: '2026-11-02T09:00:00+07:00', endDateTime: '2026-11-02T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false };
const conflict = { id: 'old', summary: 'Họp cũ', start: proposal.startDateTime, end: proposal.endDateTime, etag: 'version-1', timeZone: proposal.timeZone, isAllDay: false };

afterEach(() => {
  jest.clearAllMocks();
});

it('does not cancel until a second explicit confirmation', async () => {
  jest.mocked(mobileApi.resolveConflict).mockResolvedValue(undefined);
  const onResolved = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} disabled={false} onResolved={onResolved} onContinue={jest.fn()} />); });
  const press = (label: string) => tree.root.findAllByType(Action).find(action => action.props.label === label)!.props.onPress();
  act(() => press('Hủy lịch cũ'));
  expect(mobileApi.resolveConflict).not.toHaveBeenCalled();
  await act(async () => { press('Xác nhận hủy lịch cũ'); });
  expect(mobileApi.resolveConflict).toHaveBeenCalledWith(proposal, conflict, 'cancel', undefined);
  expect(onResolved).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it.each([
  { label: 'non-existent Feb 30', start: '2026-02-30T14:00', end: '2026-02-30T15:00' },
  { label: 'non-leap Feb 29', start: '2026-02-29T14:00', end: '2026-02-29T15:00' },
  { label: 'April 31', start: '2026-04-31T14:00', end: '2026-04-31T15:00' },
  { label: 'hour 24:00 out of range', start: '2026-11-02T24:00', end: '2026-11-02T25:00' },
  { label: 'minute 60 out of range', start: '2026-11-02T14:60', end: '2026-11-02T15:00' },
  { label: 'end not after start', start: '2026-11-02T15:00', end: '2026-11-02T14:00' },
])('rejects invalid reschedule input ($label) on client without calling API or locking actions', async ({ start, end }) => {
  let tree: ReactTestRenderer | undefined;
  try {
    act(() => { tree = create(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} disabled={false} onResolved={jest.fn()} onContinue={jest.fn()} />); });
    const findAction = (label: string) => tree!.root.findAllByType(Action).find(action => action.props.label === label)!;

    act(() => findAction('Đổi giờ lịch cũ').props.onPress());
    const inputs = tree!.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText(start);
      inputs[1].props.onChangeText(end);
    });
    await act(async () => { findAction('Xác nhận đổi giờ lịch cũ').props.onPress(); });

    expect(mobileApi.resolveConflict).not.toHaveBeenCalled();
    const alert = tree!.root.findAllByType(Copy).find(node => node.props.accessibilityRole === 'alert');
    expect(alert).toBeDefined();
    expect(String(alert!.props.children)).toMatch(/không hợp lệ|sau giờ bắt đầu/i);
    expect(inputs[0].props.editable).toBe(true);
    expect(inputs[1].props.editable).toBe(true);
    expect(findAction('Vẫn tạo lịch mới, giữ lịch cũ').props.disabled).toBe(false);
    expect(findAction('Quay lại').props.disabled).toBe(false);
  } finally {
    if (tree) act(() => tree!.unmount());
  }
});

it('keeps inputs editable and actions unlocked on 409 CALENDAR_CONFLICT so user can adjust times and succeed', async () => {
  jest.mocked(mobileApi.resolveConflict)
    .mockRejectedValueOnce(new CalendarConflictError([conflict], 'Giờ mới vẫn trùng với lịch hiện có hoặc bản thảo đang tạo. Vui lòng chọn khung giờ khác hoặc giữ lịch cũ.'))
    .mockResolvedValueOnce(undefined);
  const onResolved = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    act(() => { tree = create(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} disabled={false} onResolved={onResolved} onContinue={jest.fn()} />); });
    const findAction = (label: string) => tree!.root.findAllByType(Action).find(action => action.props.label === label)!;

    act(() => findAction('Đổi giờ lịch cũ').props.onPress());
    const inputs = tree!.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('2028-02-29T09:00');
      inputs[1].props.onChangeText('2028-02-29T10:00');
    });
    await act(async () => { findAction('Xác nhận đổi giờ lịch cũ').props.onPress(); });

    const alert = tree!.root.findAllByType(Copy).find(node => node.props.accessibilityRole === 'alert');
    expect(String(alert?.props.children)).toContain('Giờ mới vẫn trùng');
    expect(inputs[0].props.value).toBe('2028-02-29T09:00');
    expect(inputs[1].props.value).toBe('2028-02-29T10:00');
    expect(inputs[0].props.editable).toBe(true);
    expect(inputs[1].props.editable).toBe(true);
    expect(findAction('Xác nhận đổi giờ lịch cũ').props.disabled).toBe(false);
    expect(findAction('Quay lại').props.disabled).toBe(false);
    expect(findAction('Hủy lịch cũ').props.disabled).toBe(false);
    expect(findAction('Đổi giờ lịch cũ').props.disabled).toBe(false);
    expect(findAction('Vẫn tạo lịch mới, giữ lịch cũ').props.disabled).toBe(false);

    act(() => {
      inputs[0].props.onChangeText('2028-02-29T14:00');
      inputs[1].props.onChangeText('2028-02-29T15:00');
    });
    await act(async () => { findAction('Xác nhận đổi giờ lịch cũ').props.onPress(); });

    expect(mobileApi.resolveConflict).toHaveBeenNthCalledWith(2, proposal, conflict, 'reschedule', {
      startDateTime: '2028-02-29T14:00:00+07:00',
      endDateTime: '2028-02-29T15:00:00+07:00',
    });
    expect(onResolved).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) act(() => tree!.unmount());
  }
});

it.each([
  {
    label: '400 recurring series',
    error: new ApiError('Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.', 400, 'RECURRING_EVENT'),
    expected: 'Không thể thay đổi cả chuỗi sự kiện',
  },
  {
    label: '400 invalid input',
    error: new ApiError('Ngày giờ hoặc thông tin thay đổi lịch không hợp lệ. Vui lòng kiểm tra lại.', 400, 'INVALID_INPUT'),
    expected: 'không hợp lệ',
  },
  {
    label: '401 expired session',
    error: new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401, 'AUTH_REQUIRED'),
    expected: 'Phiên đăng nhập đã hết hạn',
  },
  {
    label: '403 permission required',
    error: new ApiError('Chưa đủ quyền Google Calendar. Vui lòng đăng nhập lại và cấp quyền.', 403, 'google_calendar_permission_required'),
    expected: 'Chưa đủ quyền Google Calendar',
  },
])('does not set refreshRequired on pre-write $label and allows keeping old event', async ({ error, expected }) => {
  jest.mocked(mobileApi.resolveConflict).mockRejectedValueOnce(error);
  const onContinue = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    act(() => { tree = create(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} disabled={false} onResolved={jest.fn()} onContinue={onContinue} />); });
    const findAction = (label: string) => tree!.root.findAllByType(Action).find(action => action.props.label === label)!;

    act(() => findAction('Hủy lịch cũ').props.onPress());
    await act(async () => { findAction('Xác nhận hủy lịch cũ').props.onPress(); });

    const alert = tree!.root.findAllByType(Copy).find(node => node.props.accessibilityRole === 'alert');
    expect(String(alert?.props.children)).toContain(expected);
    expect(findAction('Xác nhận hủy lịch cũ').props.disabled).toBe(false);
    expect(findAction('Quay lại').props.disabled).toBe(false);
    expect(findAction('Hủy lịch cũ').props.disabled).toBe(false);
    expect(findAction('Đổi giờ lịch cũ').props.disabled).toBe(false);
    expect(findAction('Vẫn tạo lịch mới, giữ lịch cũ').props.disabled).toBe(false);

    act(() => findAction('Quay lại').props.onPress());
    expect(tree!.root.findAllByType(Copy).find(node => node.props.accessibilityRole === 'alert')).toBeUndefined();

    act(() => findAction('Vẫn tạo lịch mới, giữ lịch cũ').props.onPress());
    expect(onContinue).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) act(() => tree!.unmount());
  }
});

it.each([
  {
    label: '409 STALE_EVENT',
    error: new ApiError('Sự kiện đã thay đổi hoặc không còn trùng lịch. Vui lòng kiểm tra lại xung đột trước khi tiếp tục.', 409, 'STALE_EVENT'),
    expected: 'đã thay đổi hoặc không còn trùng lịch',
  },
  {
    label: '502 gateway error',
    error: new ApiError('Không thể hoàn thành yêu cầu. Kiểm tra mạng rồi thử lại.', 502),
    expected: 'Chưa cập nhật được lịch cũ',
  },
  {
    label: 'network failure',
    error: new Error('Network down'),
    expected: 'Chưa cập nhật được lịch cũ',
  },
])('locks conflict actions with refreshRequired on $label while keeping refresh button enabled', async ({ error, expected }) => {
  jest.mocked(mobileApi.resolveConflict).mockRejectedValueOnce(error);
  const onResolved = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    act(() => { tree = create(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} disabled={false} onResolved={onResolved} onContinue={jest.fn()} />); });
    const findAction = (label: string) => tree!.root.findAllByType(Action).find(action => action.props.label === label)!;

    act(() => findAction('Đổi giờ lịch cũ').props.onPress());
    const inputs = tree!.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('2026-11-02T14:00');
      inputs[1].props.onChangeText('2026-11-02T15:00');
    });
    await act(async () => { findAction('Xác nhận đổi giờ lịch cũ').props.onPress(); });

    const alert = tree!.root.findAllByType(Copy).find(node => node.props.accessibilityRole === 'alert');
    expect(String(alert?.props.children)).toContain(expected);
    expect(inputs[0].props.editable).toBe(false);
    expect(inputs[1].props.editable).toBe(false);
    expect(findAction('Xác nhận đổi giờ lịch cũ').props.disabled).toBe(true);
    expect(findAction('Quay lại').props.disabled).toBe(true);
    expect(findAction('Hủy lịch cũ').props.disabled).toBe(true);
    expect(findAction('Đổi giờ lịch cũ').props.disabled).toBe(true);
    expect(findAction('Vẫn tạo lịch mới, giữ lịch cũ').props.disabled).toBe(true);
    expect(findAction('Kiểm tra lại xung đột').props.disabled).toBe(false);

    act(() => findAction('Kiểm tra lại xung đột').props.onPress());
    expect(onResolved).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) act(() => tree!.unmount());
  }
});

