import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AgendaCard, formatDateTime } from './AgendaCard';
import { Copy } from '../theme';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

it('does not throw for invalid dates and keeps timezone fallback for valid dates', () => {
  expect(formatDateTime('invalid')).toBe('invalid');
  expect(formatDateTime('')).toBe('');
  const input = '2027-01-02T09:00:00+07:00';
  expect(formatDateTime(input, 'Invalid/Zone')).toBe(formatDateTime(input, 'Asia/Ho_Chi_Minh'));
});

it('renders single timestamp for zero-duration events and range for regular timed events', () => {
  let zeroTree!: ReactTestRenderer;
  act(() => {
    zeroTree = create(<AgendaCard event={{ id: 'z1', summary: 'Mốc nhắc việc', start: '2026-11-24T09:45:00+07:00', end: '2026-11-24T09:45:00+07:00' }} />);
  });
  const zeroTexts = zeroTree.root.findAllByType(Copy).map(node => String(node.props.children));
  expect(zeroTexts).toContain(formatDateTime('2026-11-24T09:45:00+07:00'));
  expect(zeroTexts.some(text => text.includes('\nđến '))).toBe(false);
  act(() => zeroTree.unmount());

  let rangeTree!: ReactTestRenderer;
  act(() => {
    rangeTree = create(<AgendaCard event={{ id: 'r1', summary: 'Họp nhóm', start: '2026-11-24T09:00:00+07:00', end: '2026-11-24T10:00:00+07:00' }} />);
  });
  const rangeTexts = rangeTree.root.findAllByType(Copy).map(node => String(node.props.children));
  expect(rangeTexts).toContain(`${formatDateTime('2026-11-24T09:00:00+07:00')}\nđến ${formatDateTime('2026-11-24T10:00:00+07:00')}`);
  act(() => rangeTree.unmount());
});
