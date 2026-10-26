import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ProposalCard } from './ProposalModal';
import { Action } from '../theme';
import { Switch } from 'react-native';
import { CalendarConflictError, mobileApi } from '../services/api';

jest.mock('../services/api', () => ({
  CalendarConflictError: class extends Error {
    readonly conflicts: unknown[];
    constructor(conflicts: unknown[]) { super('Xung đột'); this.conflicts = conflicts; }
  },
  mobileApi: { confirm: jest.fn(), conflicts: jest.fn(), resolveConflict: jest.fn() },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const draft = { proposalId: 'stable-id', summary: 'Họp nhóm', startDateTime: '2027-01-02T09:00:00+07:00', endDateTime: '2027-01-02T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: true };
const event = { id: 'event-id', summary: draft.summary, start: draft.startDateTime, end: draft.endDateTime };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

it('creates only on explicit confirmation, guards double tap, persists exact payload first', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const onCreated = jest.fn().mockResolvedValue(undefined);
  let resolve!: (value: typeof event) => void;
  jest.mocked(mobileApi.confirm).mockImplementation(() => new Promise(done => { resolve = done; }));
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard proposal={draft} disabled={false} onSubmit={onSubmit} onCreated={onCreated} onEdit={jest.fn()} />); });
  expect(mobileApi.confirm).not.toHaveBeenCalled();
  const confirm = tree.root.findAllByType(Action).find(action => action.props.label === 'Xác nhận tạo lịch')!;
  act(() => { confirm.props.onPress(); confirm.props.onPress(); });
  await flush();
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(mobileApi.confirm).toHaveBeenCalledTimes(1);
  expect(mobileApi.confirm).toHaveBeenCalledWith({ ...draft, reminderMinutes: [60, 10] }, expect.anything(), false);
  await act(async () => { resolve(event); });
  expect(onCreated).toHaveBeenCalledWith(draft.proposalId, event);
  act(() => tree.unmount());
});

it('shows conflicts and never retries with an override without explicit choice', async () => {
  const conflict = { id: 'old', summary: 'Lịch cũ', start: draft.startDateTime, end: draft.endDateTime, etag: 'v1', timeZone: draft.timeZone, isAllDay: false };
  jest.mocked(mobileApi.confirm).mockReset().mockRejectedValueOnce(new CalendarConflictError([conflict])).mockResolvedValueOnce(event);
  const onCreated = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard proposal={draft} disabled={false} onSubmit={async () => undefined} onCreated={onCreated} onEdit={jest.fn()} />); });
  act(() => tree.root.findAllByType(Action).find(action => action.props.label === 'Xác nhận tạo lịch')!.props.onPress());
  await flush();
  expect(onCreated).not.toHaveBeenCalled();
  expect(mobileApi.confirm).toHaveBeenCalledTimes(1);
  act(() => tree.root.findAllByType(Action).find(action => action.props.label === 'Vẫn tạo lịch mới, giữ lịch cũ')!.props.onPress());
  await flush();
  expect(mobileApi.confirm).toHaveBeenLastCalledWith({ ...draft, reminderMinutes: [60, 10] }, expect.anything(), true);
  expect(onCreated).toHaveBeenCalledWith(draft.proposalId, event);
  act(() => tree.unmount());
});

it('restores the parent-held Meet choice after a virtualized row remounts', () => {
  const onMeetChange = jest.fn();
  const props = { proposal: draft, disabled: false, onSubmit: jest.fn(), onCreated: jest.fn(), onEdit: jest.fn(), onMeetChange };
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard {...props} />); });
  act(() => tree.root.findAllByType(Switch)[0].props.onValueChange(false));
  expect(onMeetChange).toHaveBeenCalledWith(draft.proposalId, false);
  act(() => tree.unmount());
  act(() => { tree = create(<ProposalCard {...props} meetChoice={false} />); });
  expect(tree.root.findAllByType(Switch)[0].props.value).toBe(false);
  act(() => tree.unmount());
});

it.each([{ reminderMinutes: [30, 5] }, { reminderMinutes: [] }])('freezes saved reminders before persistence and keeps them across settings changes (%j)', async ({ reminderMinutes }) => {
  jest.mocked(mobileApi.confirm).mockReset().mockRejectedValue(new Error('Mất mạng'));
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const props = { proposal: draft, disabled: false, onSubmit, onCreated: jest.fn(), onEdit: jest.fn() };
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard {...props} reminderMinutes={reminderMinutes} />); });
  act(() => tree.root.findAllByType(Action)[0].props.onPress());
  await flush();
  const submitted = onSubmit.mock.calls[0][0];
  expect(submitted.reminderMinutes).toEqual(reminderMinutes);
  expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(mobileApi.confirm).mock.invocationCallOrder[0]);
  act(() => tree.update(<ProposalCard {...props} reminderMinutes={[90]} />));
  act(() => tree.root.findAllByType(Action)[0].props.onPress());
  await flush();
  expect(mobileApi.confirm).toHaveBeenLastCalledWith(submitted, expect.anything(), false);
  expect(onSubmit.mock.calls[1][0]).toBe(submitted);
  act(() => tree.unmount());
});

it.each([{ reminderMinutes: undefined }, { reminderMinutes: [25] }, { reminderMinutes: [] }])('retries persisted drafts without replacing reminders with current settings (%j)', async ({ reminderMinutes }) => {
  jest.mocked(mobileApi.confirm).mockReset().mockResolvedValue(event);
  const submitted = reminderMinutes === undefined ? draft : { ...draft, reminderMinutes };
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard proposal={draft} submitted={submitted} reminderMinutes={[120]} disabled={false} onSubmit={onSubmit} onCreated={jest.fn()} onEdit={jest.fn()} />); });
  act(() => tree.root.findAllByType(Action)[0].props.onPress());
  await flush();
  expect(onSubmit).toHaveBeenCalledWith(submitted);
  expect(mobileApi.confirm).toHaveBeenCalledWith(submitted, expect.anything(), false);
  if (reminderMinutes === undefined) expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('reminderMinutes');
  act(() => tree.unmount());
});

it('prioritizes explicit proposal reminders over default settings on first submit', async () => {
  jest.mocked(mobileApi.confirm).mockReset().mockResolvedValue(event);
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard proposal={{ ...draft, reminderMinutes: [15] }} reminderMinutes={[60, 10]} disabled={false} onSubmit={onSubmit} onCreated={jest.fn()} onEdit={jest.fn()} />); });
  act(() => tree.root.findAllByType(Action)[0].props.onPress());
  await flush();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ reminderMinutes: [15] }));
  expect(mobileApi.confirm).toHaveBeenCalledWith(expect.objectContaining({ reminderMinutes: [15] }), expect.anything(), false);
  act(() => tree.unmount());
});

it('aborts and ignores stale calendar responses after leaving a conversation', async () => {
  let resolve!: (value: typeof event) => void;
  jest.mocked(mobileApi.confirm).mockImplementation(() => new Promise(done => { resolve = done; }));
  const onCreated = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ProposalCard proposal={draft} disabled={false} onSubmit={async () => undefined} onCreated={onCreated} onEdit={jest.fn()} />); });
  act(() => tree.root.findAllByType(Action)[0].props.onPress());
  await flush();
  const signal = jest.mocked(mobileApi.confirm).mock.calls[0][1];
  act(() => tree.unmount());
  expect(signal?.aborted).toBe(true);
  await act(async () => { resolve(event); });
  expect(onCreated).not.toHaveBeenCalled();
});
