import React from 'react';
import { Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CalendarCheck, Copy as CopyIcon, ExternalLink, Video } from 'lucide-react-native';
import { type CalendarEvent } from '../types';
import { Action, Copy, Panel, useTheme } from '../theme';
import { openLink, safeHttpsUrl } from '../services/links';

export function formatDateTime(input: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { timeZone: timeZone || 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(input));
  } catch {
    return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(input));
  }
}

export function AgendaCard({ event, created = false, requestedMeet = false }: { event: CalendarEvent; created?: boolean; requestedMeet?: boolean }) {
  const { colors } = useTheme();
  const meet = event.hangoutLink ? safeHttpsUrl(event.hangoutLink, 'meet') : null;
  const calendar = event.htmlLink ? safeHttpsUrl(event.htmlLink, 'calendar') : null;
  const run = (promise: Promise<unknown>) => { void promise.catch(() => Alert.alert('Không thể mở liên kết', 'Vui lòng kiểm tra mạng và thử lại.')); };
  return <Panel style={{ gap: 10, borderColor: created ? colors.teal : colors.border }}>
    {created && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><CalendarCheck size={18} color={colors.teal} /><Copy strong style={{ color: colors.teal }}>Đã tạo trên Google Calendar</Copy></View>}
    <Copy strong style={{ fontSize: 17 }}>{event.summary}</Copy>
    <Copy style={{ color: colors.accent }}>{event.isAllDay ? `${event.start.slice(0, 10)} · Cả ngày` : `${formatDateTime(event.start, event.timeZone)}\nđến ${formatDateTime(event.end, event.timeZone)}`}</Copy>
    <Copy style={{ color: colors.muted, fontSize: 12 }}>{event.timeZone || 'Asia/Ho_Chi_Minh'}</Copy>
    {!!event.description && <Copy>{event.description}</Copy>}
    {created && requestedMeet && !meet && <Copy style={{ color: colors.muted }}>{event.meetStatus === 'failure' ? 'Sự kiện đã tạo, nhưng Google chưa tạo được Meet. Mở Calendar để kiểm tra.' : 'Sự kiện đã tạo. Google chưa trả link Meet; vui lòng kiểm tra lại trong Calendar.'}</Copy>}
    {meet && <><Action label="Tham gia Google Meet" icon={Video} onPress={() => run(openLink(meet, 'meet'))} /><Action label="Sao chép link Meet" icon={CopyIcon} onPress={() => run(Clipboard.setStringAsync(meet).then(() => Alert.alert('Đã sao chép', 'Link Google Meet đã được sao chép.')))} /></>}
    {calendar && <Action label="Mở Google Calendar" icon={ExternalLink} onPress={() => run(openLink(calendar, 'calendar'))} />}
  </Panel>;
}
