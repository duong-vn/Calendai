import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { VoiceAssistantBar } from './VoiceAssistantBar';
import { IconButton } from '../theme';

const mockEvents: Record<string, (event: { results?: Array<{ transcript: string }> }) => void> = {};
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    abort: jest.fn(), start: jest.fn(), isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  useSpeechRecognitionEvent: (name: string, callback: (event: unknown) => void) => { mockEvents[name] = callback; },
}));
function setup() {
  const onChange = jest.fn(); const onSend = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<VoiceAssistantBar value="" onChange={onChange} onSend={onSend} isLoading={false} disabled={false} onStop={jest.fn()} modelLabel="Mặc định" onModel={jest.fn()} />); });
  const mic = () => tree.root.findAllByType(IconButton).find(button => String(button.props.label).includes('giọng nói'))!;
  return { tree, onChange, onSend, mic };
}
it('requests permission only on tap, adds Vietnamese speech to draft without sending', async () => {
  const { tree, onChange, onSend, mic } = setup();
  expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => { mic().props.onPress(); });
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'vi-VN' }));
  act(() => mockEvents.result({ results: [{ transcript: 'Họp nhóm sáng mai' }] }));
  expect(onChange).toHaveBeenCalledWith('Họp nhóm sáng mai');
  expect(onSend).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
});
it('does not start after permission resolves if app goes to background', async () => {
  let background!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => { background = listener; return { remove: jest.fn() }; });
  let resolve!: (value: { granted: boolean }) => void;
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockImplementationOnce(() => new Promise(done => { resolve = done as typeof resolve; }));
  const { tree, mic } = setup();
  act(() => mic().props.onPress());
  act(() => background('background'));
  await act(async () => resolve({ granted: true }));
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
