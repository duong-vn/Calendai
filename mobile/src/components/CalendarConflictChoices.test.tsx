import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CalendarConflictChoices } from './CalendarConflictChoices';
import { Action } from '../theme';
import { mobileApi } from '../services/api';

jest.mock('../services/api', () => ({ mobileApi: { resolveConflict: jest.fn() } }));
const proposal = { proposalId: 'new', summary: 'Họp mới', startDateTime: '2026-11-02T09:00:00+07:00', endDateTime: '2026-11-02T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false };
const conflict = { id: 'old', summary: 'Họp cũ', start: proposal.startDateTime, end: proposal.endDateTime, etag: 'version-1', timeZone: proposal.timeZone, isAllDay: false };

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
