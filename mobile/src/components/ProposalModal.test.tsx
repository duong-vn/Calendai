import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ProposalCard } from './ProposalModal';
import { Action } from '../theme';
import { mobileApi } from '../services/api';

jest.mock('../services/api', () => ({ mobileApi: { confirm: jest.fn() } }));
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
  expect(mobileApi.confirm).toHaveBeenCalledWith(draft, expect.anything());
  await act(async () => { resolve(event); });
  expect(onCreated).toHaveBeenCalledWith(draft.proposalId, event);
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
