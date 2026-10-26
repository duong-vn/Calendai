import React, { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import type { MeetingProposal } from '../types';
import { Action, Copy, useTheme } from '../theme';
import { mobileApi, type CalendarConflict } from '../services/api';
import { formatDateTime } from './AgendaCard';

export function CalendarConflictChoices({ proposal, conflicts, disabled, onResolved, onContinue }: {
  proposal: MeetingProposal;
  conflicts: CalendarConflict[];
  disabled: boolean;
  onResolved: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();
  const [selection, setSelection] = useState<{ id: string; action: 'cancel' | 'reschedule' } | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const resolve = async (conflict: CalendarConflict) => {
    if (!selection || busy.current || disabled || refreshRequired) return;
    const valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    if (selection.action === 'reschedule' && (!valid.test(start) || !valid.test(end) || end <= start)) {
      setError('Nhập dạng 2026-11-02T14:00; giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      await mobileApi.resolveConflict(proposal, conflict, selection.action,
        selection.action === 'reschedule' ? { startDateTime: `${start}:00+07:00`, endDateTime: `${end}:00+07:00` } : undefined);
      setSelection(null);
      onResolved();
    } catch {
      setRefreshRequired(true);
      setError('Chưa cập nhật được lịch cũ. Kiểm tra lại xung đột hoặc Google Calendar trước khi thử lại.');
    } finally { busy.current = false; setLoading(false); }
  };
  const blocked = disabled || loading || refreshRequired;
  return <View style={{ gap: 12, borderColor: colors.brass, borderWidth: 2, borderRadius: 12, padding: 12 }}>
    <Copy strong>Khung giờ này trùng với lịch có sẵn.</Copy>
    <Copy>Lịch mới chưa được tạo. Hủy hoặc đổi giờ lịch cũ có thể gửi thông báo cho khách mời.</Copy>
    {conflicts.map(conflict => <View key={conflict.id} style={{ gap: 8 }}>
      <Copy strong>{conflict.summary}</Copy>
      <Copy>{conflict.isAllDay ? `${new Date(conflict.start).toLocaleDateString('vi-VN', { timeZone: conflict.timeZone })} → ${new Date(conflict.end).toLocaleDateString('vi-VN', { timeZone: conflict.timeZone })} · Cả ngày (không bao gồm ngày kết thúc)` : `${formatDateTime(conflict.start, 'Asia/Ho_Chi_Minh')} → ${formatDateTime(conflict.end, 'Asia/Ho_Chi_Minh')}`}</Copy>
      <Action label="Hủy lịch cũ" disabled={blocked} onPress={() => { setError(''); setSelection({ id: conflict.id, action: 'cancel' }); }} />
      <Action label="Đổi giờ lịch cũ" disabled={blocked} onPress={() => { setError(''); setSelection({ id: conflict.id, action: 'reschedule' }); }} />
      {selection?.id === conflict.id && <View style={{ gap: 8 }}>
        {selection.action === 'cancel' ? <Copy strong>Xác nhận hủy “{conflict.summary}”? Lịch mới vẫn chưa được tạo.</Copy> : <>
          <Copy>Giờ Việt Nam (GMT+7). Chỉ đổi thời gian, giữ nguyên nội dung và khách mời.</Copy>
          <Copy>Bắt đầu mới</Copy>
          <TextInput accessibilityLabel="Bắt đầu mới" placeholder="2026-11-02T14:00" placeholderTextColor={colors.muted} value={start} onChangeText={setStart} editable={!blocked} autoCapitalize="none" style={{ color: colors.ink, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 }} />
          <Copy>Kết thúc mới</Copy>
          <TextInput accessibilityLabel="Kết thúc mới" placeholder="2026-11-02T15:00" placeholderTextColor={colors.muted} value={end} onChangeText={setEnd} editable={!blocked} autoCapitalize="none" style={{ color: colors.ink, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 }} />
        </>}
        <Action label={loading ? 'Đang cập nhật…' : selection.action === 'cancel' ? 'Xác nhận hủy lịch cũ' : 'Xác nhận đổi giờ lịch cũ'} primary disabled={blocked} onPress={() => { void resolve(conflict); }} />
        <Action label="Quay lại" disabled={blocked} onPress={() => setSelection(null)} />
      </View>}
    </View>)}
    {!!error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    <Action label="Vẫn tạo lịch mới, giữ lịch cũ" disabled={blocked} primary onPress={onContinue} />
    <Action label="Kiểm tra lại xung đột" disabled={disabled || loading} onPress={onResolved} />
  </View>;
}
