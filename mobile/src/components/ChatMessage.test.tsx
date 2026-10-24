import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Message } from 'ai';
import { ChatMessage } from './ChatMessage';
import { Copy } from '../theme';

jest.mock('./ProposalModal', () => ({ ProposalCard: () => null }));
jest.mock('./AgendaCard', () => ({ AgendaCard: () => null }));
jest.mock('../services/links', () => ({ openLink: jest.fn() }));
jest.mock('@ronradtke/react-native-markdown-display', () => () => null);

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
