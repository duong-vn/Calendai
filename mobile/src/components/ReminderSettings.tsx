import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Action, Copy, Panel, useTheme } from '../theme';
import { DEFAULT_REMINDER_MINUTES, parseReminderMinutes } from '../types';

const fieldsFor = (minutes: number[]) => Array.from({ length: 5 }, (_, index) => minutes[index]?.toString() ?? '');

export function ReminderSettings({ minutes, onSave }: { minutes: number[]; onSave: (minutes: number[]) => Promise<void> }) {
  const { colors } = useTheme();
  const [fields, setFields] = useState(() => fieldsFor(minutes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  useEffect(() => { setFields(fieldsFor(minutes)); }, [minutes]);
  const save = async (values: string[]) => {
    if (busy.current) return;
    setError(''); setSaved(false);
    try {
      const filled = values.map(value => value.trim()).filter(Boolean);
      if (filled.some(value => !/^\d+$/.test(value))) throw new Error('Vui lòng nhập số phút nguyên từ 0 đến 40320.');
      const next = parseReminderMinutes(filled.map(Number));
      busy.current = true; setSaving(true);
      await onSave(next);
      setFields(fieldsFor(next)); setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa lưu được tùy chọn nhắc lịch. Vui lòng thử lại.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <Panel style={{ gap: 12 }}>
    <Copy strong style={{ fontSize: 18 }}>Nhắc lịch</Copy>
    <Copy style={{ color: colors.muted }}>Thông báo bật lên (popup) qua Google Calendar, không phải thông báo riêng của Calendai. Mặc định nhắc trước 60 và 10 phút.</Copy>
    <Copy>Nhập tối đa 5 mốc khác nhau (0–40320 phút). 0 là lúc bắt đầu; để trống để bỏ mốc.</Copy>
    {fields.map((value, index) => <View key={index} style={{ gap: 4 }}>
      <Copy>Mốc {index + 1} · Số phút trước cuộc hẹn</Copy>
      <TextInput accessibilityLabel={`Mốc nhắc ${index + 1} (phút)`} keyboardType="number-pad" value={value} editable={!saving}
        onChangeText={text => { setFields(current => current.map((field, i) => i === index ? text : field)); setSaved(false); setError(''); }}
        placeholder="Không nhắc" placeholderTextColor={colors.muted}
        style={{ minHeight: 48, color: colors.ink, borderColor: colors.border, borderWidth: 2, borderRadius: 12, padding: 12, backgroundColor: colors.surface }} />
    </View>)}
    {!!error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    {saved && <Copy accessibilityLiveRegion="polite" style={{ color: colors.teal }}>Đã lưu tùy chọn nhắc lịch.</Copy>}
    <Action label={saving ? 'Đang lưu…' : 'Lưu nhắc lịch'} primary disabled={saving} onPress={() => { void save(fields); }} />
    <Action label="Tắt nhắc lịch" disabled={saving} onPress={() => { void save([]); }} />
    <Action label="Khôi phục 60 và 10 phút" disabled={saving} onPress={() => { void save(DEFAULT_REMINDER_MINUTES.map(String)); }} />
    <Copy style={{ color: colors.muted, fontSize: 12 }}>Chỉ lưu trên thiết bị này và áp dụng khi xác nhận bản thảo mới. Không đổi sự kiện đã tạo hoặc bản thảo đã gửi đang chờ thử lại.</Copy>
  </Panel>;
}
