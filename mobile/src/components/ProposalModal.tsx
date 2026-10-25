import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';
import { Calendar, Check, Edit3 } from 'lucide-react-native';
import type { CalendarEvent, MeetingProposal } from '../types';
import { Action, Copy, Panel, useTheme } from '../theme';
import { mobileApi } from '../services/api';
import { AgendaCard, formatDateTime } from './AgendaCard';

// Inline ticket, not an interrupting modal: the draft stays next to its conversation.
export function ProposalCard({ proposal, submitted, event, disabled, meetChoice, onMeetChange, onSubmit, onCreated, onEdit }: {
  proposal: MeetingProposal;
  submitted?: MeetingProposal;
  event?: CalendarEvent;
  disabled: boolean;
  meetChoice?: boolean;
  onMeetChange?: (id: string, value: boolean) => void;
  onSubmit: (proposal: MeetingProposal) => Promise<void>;
  onCreated: (proposalId: string, event: CalendarEvent) => Promise<void>;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const [createMeet, setCreateMeet] = useState(proposal.createMeet);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; controller.current?.abort(); }, []);
  const draft = submitted || { ...proposal, createMeet: meetChoice ?? createMeet };
  const confirm = async () => {
    if (busy.current || disabled || event) return;
    busy.current = true;
    setLoading(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      // Persist the exact payload before any network side effect; retries never mutate it.
      await onSubmit(draft);
      if (!mounted.current || abort.signal.aborted) return;
      const created = await mobileApi.confirm(draft, abort.signal);
      if (mounted.current) await onCreated(draft.proposalId, created);
    } catch (failure) {
      if (mounted.current && !abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Chưa tạo được lịch. Vui lòng thử lại cùng bản thảo.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  if (event) return <AgendaCard event={event} created requestedMeet={draft.createMeet} />;
  return <Panel style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Calendar size={20} color={colors.accent} /><Copy strong style={{ color: colors.accent }}>Vé họp · Chờ xác nhận</Copy></View>
    <Copy strong style={{ fontSize: 18 }}>{draft.summary}</Copy>
    {!!draft.description && <Copy style={{ color: colors.muted }}>{draft.description}</Copy>}
    <View style={{ backgroundColor: colors.raised, borderRadius: 10, padding: 12, gap: 6 }}>
      <Copy strong>{formatDateTime(draft.startDateTime, draft.timeZone)}</Copy>
      <Copy>đến {formatDateTime(draft.endDateTime, draft.timeZone)}</Copy>
      <Copy style={{ color: colors.muted, fontSize: 12 }}>{draft.timeZone}</Copy>
      <Copy style={{ color: colors.muted }}>Khách mời: {draft.attendees.length ? draft.attendees.map(a => a.email).join(', ') : 'Không có'}</Copy>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Copy strong style={{ flex: 1 }}>Tạo Google Meet</Copy><Switch accessibilityLabel="Tạo link Google Meet" value={draft.createMeet} onValueChange={value => { setCreateMeet(value); onMeetChange?.(proposal.proposalId, value); }} disabled={loading || !!submitted || disabled} trackColor={{ true: colors.teal }} /></View>
    {submitted && <Copy style={{ color: colors.muted, fontSize: 12 }}>Bản thảo đã gửi được giữ nguyên để thử lại an toàn. Muốn đổi nội dung, hãy yêu cầu một bản thảo mới.</Copy>}
    {!!error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Đang tạo lịch" />}
    <Action label={loading ? 'Đang xác nhận…' : submitted ? 'Thử xác nhận lại' : 'Xác nhận tạo lịch'} icon={Check} primary disabled={loading || disabled} onPress={() => { void confirm(); }} />
    <Action label="Chỉnh sửa qua trò chuyện" icon={Edit3} disabled={loading || disabled} onPress={onEdit} />
    <Copy style={{ color: colors.muted, fontSize: 11 }}>Chỉ khi bạn xác nhận, Calendai mới tạo lịch và gửi lời mời.</Copy>
  </Panel>;
}
