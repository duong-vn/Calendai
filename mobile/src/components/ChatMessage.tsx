import React, { memo, useMemo } from 'react';
import { Alert, View } from 'react-native';
import type { Message } from 'ai';
import Markdown from '@ronradtke/react-native-markdown-display';
import { Sparkles, UserRound } from 'lucide-react-native';
import { isRecord, parseEvent, parseProposal, type CalendarEvent, type MeetingProposal } from '../types';
import { Copy, useTheme } from '../theme';
import { openLink } from '../services/links';
import { AgendaCard } from './AgendaCard';
import { ProposalCard } from './ProposalModal';

const markdownRules = { image: () => null };

export const ChatMessage = memo(function ChatMessage({ message, confirmed, submitted, disabled, streaming = false, reminderMinutes, meetChoices, onMeetChange, onSubmit, onCreated, onEdit }: {
  message: Message;
  confirmed: Record<string, CalendarEvent>;
  submitted: Record<string, MeetingProposal>;
  disabled: boolean;
  streaming?: boolean;
  reminderMinutes?: number[];
  meetChoices?: Record<string, boolean>;
  onMeetChange?: (id: string, value: boolean) => void;
  onSubmit: (proposal: MeetingProposal) => Promise<void>;
  onCreated: (id: string, event: CalendarEvent) => Promise<void>;
  onEdit: (proposal: MeetingProposal) => void;
}) {
  const { colors, fonts } = useTheme();
  const markdownStyle = useMemo(() => ({
    body: { color: colors.ink, fontSize: 14, lineHeight: 23, fontFamily: fonts ? 'Jakarta' : undefined },
    heading1: { color: colors.ink, fontSize: 23 }, heading2: { color: colors.ink, fontSize: 20 }, heading3: { color: colors.ink, fontSize: 17 },
    strong: { color: colors.ink, fontFamily: fonts ? 'JakartaBold' : undefined },
    link: { color: colors.accent, textDecorationLine: 'underline' as const },
    code_inline: { color: colors.accent, backgroundColor: colors.raised },
    fence: { color: colors.ink, backgroundColor: colors.raised, borderColor: colors.border },
    code_block: { color: colors.ink, backgroundColor: colors.raised, borderColor: colors.border },
    blockquote: { backgroundColor: colors.raised, borderColor: colors.brass },
    table: { borderColor: colors.border }, th: { padding: 6 }, td: { padding: 6 }, tr: { borderColor: colors.border },
  }), [colors, fonts]);
  const user = message.role === 'user';
  const proposalResults = message.toolInvocations?.filter(tool => tool.toolName === 'proposeMeeting' && tool.state === 'result') || [];
  const compactProposals = !user && proposalResults.length > 1;
  const renderProposal = (tool: NonNullable<Message['toolInvocations']>[number]) => {
    if (tool.state !== 'result') return null;
    try {
      const proposal = parseProposal(tool.result);
      return <View key={tool.toolCallId} style={{ width: '100%' }}><ProposalCard compact={compactProposals} reminderMinutes={reminderMinutes} proposal={proposal} meetChoice={meetChoices?.[proposal.proposalId]} onMeetChange={onMeetChange} submitted={submitted[proposal.proposalId]} event={confirmed[proposal.proposalId]} disabled={disabled} onSubmit={onSubmit} onCreated={onCreated} onEdit={() => onEdit(proposal)} /></View>;
    } catch { return <Copy key={tool.toolCallId} style={{ color: colors.danger }}>Bản thảo chưa hợp lệ. Vui lòng yêu cầu Calendai tạo lại.</Copy>; }
  };
  const Icon = user ? UserRound : Sparkles;
  if (!message.content && !message.toolInvocations?.length) return null;
  return <View style={{ gap: 8, alignItems: user ? 'flex-end' : 'flex-start', marginBottom: 22 }}>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon size={17} color={colors.accent} /><Copy strong style={{ fontSize: 12, color: colors.muted }}>{user ? 'Bạn' : 'Calendai'}</Copy></View>
    {!!message.content && <View style={{ maxWidth: '100%', borderWidth: 2, borderColor: colors.border, borderRadius: 18, backgroundColor: user ? colors.user : colors.surface, paddingHorizontal: 14, paddingVertical: 6 }}>
      <Markdown onLinkPress={url => { void openLink(url).catch(() => Alert.alert('Không mở được liên kết', 'Chỉ hỗ trợ đường dẫn HTTPS hợp lệ.')); return false; }} style={markdownStyle} rules={markdownRules}>{message.content}</Markdown>
    </View>}
    {message.toolInvocations?.map(tool => {
      if (tool.state !== 'result') {
        if (streaming) return <Copy key={tool.toolCallId} style={{ color: colors.muted }}>Đang chuẩn bị {tool.toolName === 'proposeMeeting' ? 'bản thảo cuộc họp' : 'dữ liệu lịch'}…</Copy>;
        return <View key={tool.toolCallId} style={{ width: '100%', gap: 6, marginVertical: 4 }}>
          <Copy style={{ color: colors.danger }}>Chưa hoàn tất {tool.toolName === 'proposeMeeting' ? 'tạo bản thảo cuộc họp' : 'tải dữ liệu lịch'}.</Copy>
          <Copy style={{ color: colors.muted }}>Hãy nhắn yêu cầu lại để trợ lý tiếp tục.</Copy>
        </View>;
      }
      if (tool.toolName === 'proposeMeeting') {
        if (tool.toolCallId !== proposalResults[0].toolCallId) return null;
        return <View key="meeting-proposals" accessibilityLabel={compactProposals ? 'Các cuộc họp đề xuất' : undefined} style={{ width: '100%' }}>
          {proposalResults.map((proposalTool, index) => <View key={proposalTool.toolCallId} style={compactProposals ? { paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border } : undefined}>{renderProposal(proposalTool)}</View>)}
        </View>;
      }
      if (tool.toolName === 'listUpcomingEvents') {
        const result: unknown = tool.result;
        if (!isRecord(result) || result.success !== true || result.mode === 'mock' || !Array.isArray(result.events)) return <Copy key={tool.toolCallId} style={{ color: colors.danger }}>Không lấy được lịch thật. Kiểm tra kết nối Google rồi thử lại.</Copy>;
        try {
          const events = result.events.map(parseEvent);
          return <View key={tool.toolCallId} style={{ width: '100%', gap: 12 }}><Copy strong>Lịch sắp tới</Copy>{events.length ? events.map(event => <AgendaCard key={event.id} event={event} />) : <Copy style={{ color: colors.muted }}>Không có sự kiện trong khoảng thời gian này.</Copy>}</View>;
        } catch { return <Copy key={tool.toolCallId} style={{ color: colors.danger }}>Dữ liệu lịch trả về chưa hợp lệ. Vui lòng thử tải lịch sắp tới.</Copy>; }
      }
      return null;
    })}
  </View>;
});
