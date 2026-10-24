import React, { useEffect, useRef, useState } from 'react';
import { AppState, TextInput, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { ArrowUp, Cpu, Mic, MicOff, Square } from 'lucide-react-native';
import { Copy, IconButton, useTheme } from '../theme';

export function VoiceAssistantBar({ value, onChange, onSend, isLoading, disabled, onStop, modelLabel, onModel, voiceEnabled = true }: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled: boolean;
  onStop: () => void;
  modelLabel: string;
  onModel: () => void;
  voiceEnabled?: boolean;
}) {
  const { colors, fonts } = useTheme();
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const generation = useRef(0);
  const prefix = useRef('');
  const stop = () => {
    ++generation.current;
    active.current = false;
    ExpoSpeechRecognitionModule.abort();
    setListening(false);
    setPending(false);
  };
  useSpeechRecognitionEvent('start', () => { if (active.current) setListening(true); });
  useSpeechRecognitionEvent('end', () => { active.current = false; setListening(false); setPending(false); });
  useSpeechRecognitionEvent('result', event => {
    if (!active.current) return;
    const text = event.results[0]?.transcript;
    if (text) onChange(`${prefix.current}${text}`);
  });
  useSpeechRecognitionEvent('error', event => {
    if (!active.current) return;
    active.current = false;
    setListening(false);
    setPending(false);
    if (event.error !== 'aborted') setError(event.error === 'not-allowed' ? 'Chưa có quyền mic/nhận diện giọng nói. Cho phép trong Cài đặt để thử lại.' : event.error === 'no-speech' ? 'Chưa nghe rõ. Bạn có thể bấm mic và nói lại.' : 'Không nhận diện được giọng nói. Kiểm tra dịch vụ giọng nói và mạng của thiết bị.');
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => { ++generation.current; active.current = false; ExpoSpeechRecognitionModule.abort(); subscription.remove(); };
  }, []);
  useEffect(() => { if (!voiceEnabled || disabled || isLoading) stop(); }, [voiceEnabled, disabled, isLoading]);
  const toggle = async () => {
    if (active.current || pending) { stop(); return; }
    const revision = ++generation.current;
    setPending(true);
    setError('');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new Error('Thiết bị chưa có dịch vụ nhận diện giọng nói. Bạn vẫn có thể nhập bằng bàn phím.');
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (revision !== generation.current) return;
      if (!permission.granted) throw new Error('Vui lòng cho phép mic và nhận diện giọng nói trong Cài đặt.');
      prefix.current = value.trim() ? `${value.trim()} ` : '';
      active.current = true;
      ExpoSpeechRecognitionModule.start({ lang: 'vi-VN', interimResults: true, continuous: false });
    } catch (failure) {
      if (revision === generation.current) { active.current = false; setError(failure instanceof Error ? failure.message : 'Không mở được mic.'); }
    } finally { if (revision === generation.current) setPending(false); }
  };
  return <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 6, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.border }}>
    {!!error && <Copy accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Copy>}
    {(listening || pending) && <Copy accessibilityLiveRegion="polite" style={{ color: colors.teal, fontSize: 12 }}>{pending ? 'Đang xin quyền mic…' : 'Đang nghe tiếng Việt… Bấm mic để dừng.'}</Copy>}
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderRadius: 20, borderWidth: 2, borderColor: listening ? colors.teal : colors.border, backgroundColor: colors.surface, padding: 6 }}>
      <TextInput accessibilityLabel="Tin nhắn cho Calendai" value={value} onChangeText={onChange} multiline placeholder="Nhắn Calendai đặt lịch…" placeholderTextColor={colors.muted} editable={!disabled && !listening && !pending} maxLength={12000} selectionColor={colors.accent} style={{ flex: 1, minHeight: 46, maxHeight: 144, paddingHorizontal: 10, paddingVertical: 12, color: colors.ink, fontFamily: fonts ? 'Jakarta' : undefined, fontSize: 14, textAlignVertical: 'top' }} />
      <IconButton icon={listening || pending ? MicOff : Mic} label={listening || pending ? 'Dừng nhận diện giọng nói' : 'Nhập bằng giọng nói tiếng Việt'} onPress={() => { void toggle(); }} disabled={disabled || isLoading || !voiceEnabled} />
      <IconButton icon={isLoading ? Square : ArrowUp} label={isLoading ? 'Dừng phản hồi' : 'Gửi tin nhắn'} onPress={() => { stop(); isLoading ? onStop() : onSend(); }} disabled={!isLoading && (disabled || !value.trim())} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}><IconButton icon={Cpu} label={`Chọn mô hình AI: ${modelLabel}`} onPress={() => { stop(); onModel(); }} disabled={isLoading} /><Copy numberOfLines={1} style={{ color: colors.muted, fontSize: 11, flexShrink: 1 }}>{modelLabel}</Copy></View>
      <Copy style={{ color: colors.muted, fontSize: 10 }}>Giờ Việt Nam · GMT+7</Copy>
    </View>
  </View>;
}
