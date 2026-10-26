import React from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Action, Copy } from '../theme';
import { ReminderSettings } from './ReminderSettings';

it('saves custom minutes, disables explicitly and restores defaults', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ReminderSettings minutes={[60, 10]} onSave={onSave} />); });
  expect(tree.root.findAllByType(TextInput).map(input => input.props.value)).toEqual(['60', '10', '', '', '']);
  act(() => tree.root.findAllByType(TextInput)[0].props.onChangeText('90'));
  await act(async () => tree.root.findAllByType(Action).find(action => action.props.label === 'Lưu nhắc lịch')!.props.onPress());
  expect(onSave).toHaveBeenLastCalledWith([90, 10]);
  await act(async () => tree.root.findAllByType(Action).find(action => action.props.label === 'Tắt nhắc lịch')!.props.onPress());
  expect(onSave).toHaveBeenLastCalledWith([]);
  await act(async () => tree.root.findAllByType(Action).find(action => action.props.label === 'Khôi phục 60 và 10 phút')!.props.onPress());
  expect(onSave).toHaveBeenLastCalledWith([60, 10]);
  act(() => tree.unmount());
});

it('rejects duplicates, decimals and out-of-range input without saving', async () => {
  const onSave = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ReminderSettings minutes={[60, 10]} onSave={onSave} />); });
  for (const input of ['10', '1.5', '40321']) {
    act(() => tree.root.findAllByType(TextInput)[0].props.onChangeText(input));
    await act(async () => tree.root.findAllByType(Action).find(action => action.props.label === 'Lưu nhắc lịch')!.props.onPress());
    expect(tree.root.findAllByType(Copy).some(copy => copy.props.accessibilityRole === 'alert')).toBe(true);
  }
  expect(onSave).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it('keeps edits and shows a retryable storage failure without success feedback', async () => {
  const onSave = jest.fn().mockRejectedValue(new Error('Không lưu được'));
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<ReminderSettings minutes={[60, 10]} onSave={onSave} />); });
  act(() => tree.root.findAllByType(TextInput)[0].props.onChangeText('30'));
  await act(async () => tree.root.findAllByType(Action).find(action => action.props.label === 'Lưu nhắc lịch')!.props.onPress());
  expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('30');
  expect(tree.root.findAllByType(Copy).some(copy => copy.props.children === 'Không lưu được')).toBe(true);
  expect(tree.root.findAllByType(Copy).some(copy => copy.props.children === 'Đã lưu tùy chọn nhắc lịch.')).toBe(false);
  act(() => tree.unmount());
});
