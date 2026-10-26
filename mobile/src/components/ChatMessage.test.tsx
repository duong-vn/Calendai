import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Message } from 'ai';
import { ChatMessage } from './ChatMessage';
import { Copy } from '../theme';
import { View } from 'react-native';
import { ProposalCard } from './ProposalModal';

jest.mock('./ProposalModal', () => ({ ProposalCard: () => null }));
jest.mock('./AgendaCard', () => ({ AgendaCard: () => null }));
jest.mock('../services/links', () => ({ openLink: jest.fn() }));
const mockMarkdown = jest.fn(() => null);
jest.mock('@ronradtke/react-native-markdown-display', () => (props: unknown) => mockMarkdown());

it('does not render old markdown again when another message streams', () => {
  const props = { confirmed: {}, submitted: {}, disabled: true, onSubmit: jest.fn(), onCreated: jest.fn(), onEdit: jest.fn() };
  const old: Message = { id: 'old', role: 'assistant', content: 'Nội dung cũ' };
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ChatMessage {...props} message={old} />); });
  const renders = mockMarkdown.mock.calls.length;
  act(() => tree.update(<ChatMessage {...props} message={old} />));
  expect(mockMarkdown).toHaveBeenCalledTimes(renders);
  act(() => tree.update(<ChatMessage {...props} message={{ ...old, content: 'Nội dung mới' }} />));
  expect(mockMarkdown).toHaveBeenCalledTimes(renders + 1);
  act(() => tree.unmount());
});

it('uses one compact list for multiple proposals and keeps per-proposal callbacks and Meet choices', () => {
  const proposals = ['first', 'second'].map(proposalId => ({ proposalId, summary: `Họp ${proposalId}`, startDateTime: '2027-01-02T09:00:00+07:00', endDateTime: '2027-01-02T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false }));
  const tools = proposals.map(proposal => ({ state: 'result' as const, toolCallId: proposal.proposalId, toolName: 'proposeMeeting', args: {}, result: proposal }));
  const props = { confirmed: {}, submitted: {}, disabled: false, meetChoices: { first: true, second: false }, onMeetChange: jest.fn(), onSubmit: jest.fn(), onCreated: jest.fn(), onEdit: jest.fn() };
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ChatMessage {...props} message={{ id: 'proposals', role: 'assistant', content: '', toolInvocations: tools.slice(0, 1) }} />); });
  expect(tree.root.findAllByType(ProposalCard)[0].props.compact).toBe(false);
  act(() => tree.update(<ChatMessage {...props} message={{ id: 'proposals', role: 'assistant', content: '', toolInvocations: tools }} />));
  expect(tree.root.findAllByType(View).filter(node => node.props.accessibilityLabel === 'Các cuộc họp đề xuất')).toHaveLength(1);
  const cards = tree.root.findAllByType(ProposalCard);
  expect(cards).toHaveLength(2);
  cards.forEach((card, index) => {
    expect(card.props.compact).toBe(true);
    expect(card.props.meetChoice).toBe(index === 0);
    expect(card.props.onSubmit).toBe(props.onSubmit);
    expect(card.props.onCreated).toBe(props.onCreated);
    expect(card.props.onMeetChange).toBe(props.onMeetChange);
    card.props.onEdit();
    expect(props.onEdit).toHaveBeenLastCalledWith(proposals[index]);
  });
  act(() => tree.unmount());
});

const message: Message = { id: 'interrupted', role: 'assistant', content: '', toolInvocations: [{ state: 'call', toolCallId: 'call-1', toolName: 'proposeMeeting', args: {} }] };

it('shows an interrupted tool as incomplete after streaming stops, including when a sheet blocks input', () => {
  let tree!: ReactTestRenderer;
  const props = { message, confirmed: {}, submitted: {}, disabled: true, onSubmit: jest.fn(), onCreated: jest.fn(), onEdit: jest.fn() };
  act(() => { tree = create(<ChatMessage {...props} streaming />); });
  expect(tree.root.findAllByType(Copy).some(node => JSON.stringify(node.props.children).includes('Đang chuẩn bị'))).toBe(true);
  act(() => { tree.update(<ChatMessage {...props} streaming={false} />); });
  expect(tree.root.findAllByType(Copy).some(node => JSON.stringify(node.props.children).includes('Chưa hoàn tất'))).toBe(true);
  expect(tree.root.findAllByType(Copy).some(node => JSON.stringify(node.props.children).includes('Đang chuẩn bị'))).toBe(false);
  act(() => tree.unmount());
});
