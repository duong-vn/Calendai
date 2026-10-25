import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Message } from 'ai';
import { ChatMessage } from './ChatMessage';
import { Copy } from '../theme';

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
