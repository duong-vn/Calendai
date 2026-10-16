'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  Clock,
  Globe,
  Loader2,
  RotateCcw,
  Sparkles,
  User,
  Video,
} from 'lucide-react';
import type { CalendarEventResult } from '@/lib/calendar/types';
import {
  type ChatSession,
  deriveSessionTitle,
  generateSessionId,
  getActiveSessionId,
  loadAllSessions,
  saveCurrentSession,
  setActiveSessionId,
} from '@/lib/chat/session-storage';
import { EventCreatedCard } from './EventCreatedCard';
import {
  MeetingPreviewCard,
  type MeetingProposalData,
} from './MeetingPreviewCard';
import { ModelSelector } from './ModelSelector';

// Lazy-load drawer only when opened
const Sidenote = dynamic(
  () => import('./Sidenote').then((mod) => mod.Sidenote),
  { ssr: false }
);

const MARKDOWN_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#1f1f1f] dark:text-[#fbbf24]">
      {children}
    </strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#1a73e8] underline hover:text-[#1557b0] dark:text-[#38bdf8] dark:hover:text-[#7dd3fc]"
    >
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[#f0f4f9] px-1.5 py-0.5 text-xs text-[#1a73e8] font-mono dark:bg-[#1c2e26] dark:text-[#34d399] dark:border dark:border-[#23382d]">
      {children}
    </code>
  ),
};

interface ChatMessageItemProps {
  message: Message;
  isLast: boolean;
  isLoading: boolean;
  error?: Error;
  confirmedEvent?: { event: CalendarEventResult; isMock?: boolean };
  onConfirmSuccess: (proposalId: string, event: CalendarEventResult, isMock?: boolean) => void;
  onEditRequest: (proposal: MeetingProposalData) => void;
  onReload: () => void;
}

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isLast,
  isLoading,
  error,
  confirmedEvent,
  onConfirmSuccess,
  onEditRequest,
  onReload,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isEmptyAssistant =
    !isUser &&
    !message.content &&
    (!message.toolInvocations || message.toolInvocations.length === 0);

  // Do not render empty phantom assistant messages if not loading and no error
  if (isEmptyAssistant && !isLoading && !error) {
    return null;
  }

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 ${
          isUser
            ? 'bg-[#c25e2e] text-white border-[#2d2015] shadow-[1px_1px_0px_#2d2015] dark:bg-[#e07a3f] dark:border-[#453427] dark:text-[#14110f] dark:shadow-[1px_1px_0px_#453427]'
            : 'bg-[#ede4d5] text-[#c25e2e] border-[#2d2015] shadow-[1px_1px_0px_#2d2015] dark:bg-[#211a14] dark:border-[#d49439] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      {/* Message Bubble - expands with content up to max-width limit */}
      <div
        className={`w-fit max-w-[85%] sm:max-w-[78%] space-y-2.5 ${
          isUser
            ? 'rounded-2xl rounded-tr-xs bg-[#e8d5c4] px-4 py-3 text-sm text-[#2b1f17] border-2 border-[#2d2015] shadow-[2px_2px_0px_#2d2015] dark:bg-[#3d2719] dark:border-[#e07a3f] dark:text-[#fde8dc] dark:shadow-[2px_2px_0px_#2d1b11]'
            : 'rounded-2xl rounded-tl-xs bg-[#fffaf2] px-5 py-3.5 text-sm text-[#2b1f17] border-2 border-[#2d2015] shadow-[2px_2px_0px_#2d2015] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:border-[#453427] dark:shadow-[2px_2px_0px_#453427]'
        }`}
      >
        {message.content && (
          <div className="leading-relaxed text-sm break-words">
            <ReactMarkdown
              remarkPlugins={MARKDOWN_PLUGINS}
              components={MARKDOWN_COMPONENTS}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Empty Assistant State: only show thinking while loading, or retry if real error */}
        {isEmptyAssistant && (
          isLoading && isLast ? (
            <div className="flex items-center gap-2.5 py-0.5 text-xs text-[#5f6368] dark:text-[#94a3b8]">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-pulse dark:bg-[#10b981]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-pulse [animation-delay:150ms] dark:bg-[#38bdf8]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-pulse [animation-delay:300ms] dark:bg-[#fbbf24]" />
              </span>
              <span className="font-medium text-[#444746] dark:text-[#a7f3d0]">
                Calendai đang suy nghĩ...
              </span>
            </div>
          ) : error && isLast ? (
            <div className="flex items-center justify-between gap-3 text-xs text-[#5f6368] dark:text-[#94a3b8]">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-[#ea4335] shrink-0" />
                <span>Chưa nhận được phản hồi từ trợ lý AI.</span>
              </div>
              <button
                type="button"
                onClick={onReload}
                className="font-medium text-[#1a73e8] hover:underline shrink-0 dark:text-[#34d399]"
              >
                Thử lại
              </button>
            </div>
          ) : null
        )}

        {/* Tool Invocations */}
        {message.toolInvocations?.map((toolInvocation) => {
          const { toolName, toolCallId } = toolInvocation;

          if (toolName === 'proposeMeeting') {
            if ('result' in toolInvocation) {
              const proposal = toolInvocation.result as MeetingProposalData;

              if (confirmedEvent) {
                return (
                  <EventCreatedCard
                    key={toolCallId}
                    event={confirmedEvent.event}
                    isMock={confirmedEvent.isMock}
                  />
                );
              }

              return (
                <MeetingPreviewCard
                  key={toolCallId}
                  proposal={proposal}
                  onConfirmSuccess={(event, isMock) =>
                    onConfirmSuccess(proposal.proposalId, event, isMock)
                  }
                  onEditRequest={() => onEditRequest(proposal)}
                />
              );
            }

            return (
              <div
                key={toolCallId}
                className="flex items-center gap-2 rounded-xl bg-[#f0f4f9] p-3 text-xs text-[#1a73e8] dark:bg-[#17241e] dark:text-[#34d399] dark:border dark:border-[#23382d]"
              >
                <Loader2 className="h-4 w-4 animate-spin text-[#1a73e8] dark:text-[#10b981]" />
                <span>Đang chuẩn bị thẻ xem trước Google Calendar...</span>
              </div>
            );
          }

          if (toolName === 'listUpcomingEvents') {
            if ('result' in toolInvocation) {
              const res = toolInvocation.result as {
                success?: boolean;
                events?: Array<{
                  id: string;
                  summary: string;
                  start: string;
                  hangoutLink?: string;
                  htmlLink: string;
                }>;
                error?: string;
                note?: string;
              };

              if (!res.success) {
                return (
                  <div
                    key={toolCallId}
                    className="rounded-xl bg-[#fef7e0] p-3 text-xs text-[#b06000] border border-[#feefc3] dark:bg-[#332408] dark:text-[#fde047] dark:border-[#523b0c]"
                  >
                    {res.error || 'Không thể lấy danh sách sự kiện.'}
                  </div>
                );
              }

              return (
                <div
                  key={toolCallId}
                  className="my-2 space-y-2 rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-4 dark:border-[#23382d] dark:bg-[#16221d]"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
                    <Calendar className="h-4 w-4 text-[#1a73e8] dark:text-[#10b981]" />
                    <span>Sự kiện sắp diễn ra trên Google Calendar:</span>
                  </div>
                  {res.events && res.events.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {res.events.map((evt) => (
                        <div
                          key={evt.id}
                          className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs border border-[#dadce0] dark:bg-[#17241e] dark:border-[#23382d]"
                        >
                          <div className="truncate pr-2">
                            <span className="font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
                              {evt.summary}
                            </span>
                          </div>
                          {evt.hangoutLink && (
                            <a
                              href={evt.hangoutLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-0.5 text-[11px] font-medium text-[#137333] hover:underline dark:bg-[#082f22] dark:text-[#34d399] dark:border dark:border-[#10b981]/30"
                            >
                              <Video className="h-3 w-3" />
                              <span>Meet</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5f6368] italic dark:text-[#94a3b8]">
                      Không có sự kiện nào sắp tới trong khoảng thời gian này.
                    </p>
                  )}
                  {res.note && (
                    <p className="text-[11px] text-[#747775] italic dark:text-[#94a3b8]">
                      {res.note}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={toolCallId}
                className="flex items-center gap-2 rounded-xl bg-[#f0f4f9] p-3 text-xs text-[#5f6368] dark:bg-[#17241e] dark:text-[#94a3b8] dark:border dark:border-[#23382d]"
              >
                <Loader2 className="h-4 w-4 animate-spin text-[#1a73e8] dark:text-[#10b981]" />
                <span>Đang tra cứu Google Calendar...</span>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
});

const QUICK_PROMPTS = [
  {
    title: 'Họp nhóm dự án',
    tag: 'CHRONO-DISPATCH',
    desc: 'Lúc 10h sáng mai trong 45 phút có Google Meet',
    prompt: 'Họp nhóm dự án vào 10h sáng mai trong 45 phút, có Google Meet nhé',
    cardStyle:
      'border-2 border-[#2d2015] bg-[#fffaf2] shadow-[3px_3px_0px_#2d2015] hover:shadow-[5px_5px_0px_#2d2015] hover:border-[#c25e2e] dark:bg-[#211a14] dark:border-[#453427] dark:shadow-[3px_3px_0px_#453427] hover:dark:border-[#e07a3f] hover:dark:shadow-[5px_5px_0px_#e07a3f]',
    arrowColor: 'text-[#c25e2e] dark:text-[#e07a3f]',
    accentBadge: 'bg-[#f5eee1] text-[#c25e2e] border-[#2d2015] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:border-[#453427]',
  },
  {
    title: 'Gặp gỡ đối tác',
    tag: 'DIPLOMAT-VOYAGE',
    desc: 'partner@company.com vào 14:00 thứ 6 tuần này',
    prompt: 'Lên lịch gặp partner@company.com lúc 14:00 thứ 6 tuần này',
    cardStyle:
      'border-2 border-[#2d2015] bg-[#fffaf2] shadow-[3px_3px_0px_#2d2015] hover:shadow-[5px_5px_0px_#2d2015] hover:border-[#d49439] dark:bg-[#211a14] dark:border-[#453427] dark:shadow-[3px_3px_0px_#453427] hover:dark:border-[#fbbf24] hover:dark:shadow-[5px_5px_0px_#fbbf24]',
    arrowColor: 'text-[#d49439] dark:text-[#fbbf24]',
    accentBadge: 'bg-[#f5eee1] text-[#d49439] border-[#2d2015] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:border-[#453427]',
  },
  {
    title: 'Xem lịch trình',
    tag: 'TIME-INDEX',
    desc: 'Kiểm tra các cuộc họp sắp diễn ra',
    prompt: 'Xem các cuộc họp sắp tới của tôi',
    cardStyle:
      'border-2 border-[#2d2015] bg-[#fffaf2] shadow-[3px_3px_0px_#2d2015] hover:shadow-[5px_5px_0px_#2d2015] hover:border-[#1f7560] dark:bg-[#211a14] dark:border-[#453427] dark:shadow-[3px_3px_0px_#453427] hover:dark:border-[#2dd4bf] hover:dark:shadow-[5px_5px_0px_#2dd4bf]',
    arrowColor: 'text-[#1f7560] dark:text-[#2dd4bf]',
    accentBadge: 'bg-[#f5eee1] text-[#1f7560] border-[#2d2015] dark:bg-[#2a221b] dark:text-[#2dd4bf] dark:border-[#453427]',
  },
];

interface ChatInterfaceProps {
  isAuthenticated: boolean;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  activeSessionId?: string | null;
  onSessionsChange?: () => void;
  isTipsOpen?: boolean;
  onToggleTips?: () => void;
  onClearSession?: () => void;
}

export function ChatInterface({
  isAuthenticated,
  selectedModel: propSelectedModel,
  onSelectModel,
  activeSessionId: propActiveSessionId,
  onSessionsChange,
  isTipsOpen: externalTipsOpen,
  onToggleTips: externalToggleTips,
  onClearSession,
}: ChatInterfaceProps) {
  const [internalTipsOpen, setInternalTipsOpen] = useState(false);
  const isTipsOpen =
    externalTipsOpen !== undefined ? externalTipsOpen : internalTipsOpen;
  const toggleTips =
    externalToggleTips || (() => setInternalTipsOpen((prev) => !prev));

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return propActiveSessionId || getActiveSessionId() || generateSessionId();
  });

  const [internalSelectedModel, setInternalSelectedModel] = useState<string>('');

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('calendai_selected_model');
      if (savedModel && typeof savedModel === 'string') {
        setInternalSelectedModel(savedModel);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const activeModel =
    propSelectedModel !== undefined ? propSelectedModel : internalSelectedModel;

  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    setInput,
  } = useChat({
    api: '/api/chat',
    body: {
      model: activeModel,
    },
  });

  const [confirmedEvents, setConfirmedEvents] = useState<
    Record<string, { event: CalendarEventResult; isMock?: boolean }>
  >({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        const fakeEvent = {
          preventDefault: () => {},
        } as unknown as React.FormEvent<HTMLFormElement>;
        handleSubmit(fakeEvent);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Restore chat session from localStorage on mount or when activeSessionId changes
  useEffect(() => {
    const sessions = loadAllSessions();
    const targetId = propActiveSessionId || getActiveSessionId();
    const target = sessions.find((s) => s.id === targetId) || sessions[0];

    if (target) {
      setCurrentSessionId(target.id);
      setActiveSessionId(target.id);
      if (typeof setMessages === 'function') {
        setMessages(target.messages || []);
      }
      setConfirmedEvents(target.confirmedEvents || {});
    } else {
      // Legacy single-session fallback
      try {
        const savedMessages = localStorage.getItem('calendai_chat_messages');
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof setMessages === 'function') {
            setMessages(parsed);
          }
        }
        const savedEvents = localStorage.getItem('calendai_confirmed_events');
        if (savedEvents) {
          const parsedEvents = JSON.parse(savedEvents);
          if (parsedEvents && typeof parsedEvents === 'object') {
            setConfirmedEvents(parsedEvents);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [propActiveSessionId, setMessages]);

  // Persist messages & confirmedEvents to current session in localStorage
  useEffect(() => {
    if (messages.length > 0 || Object.keys(confirmedEvents).length > 0) {
      const all = loadAllSessions();
      const existing = all.find((s) => s.id === currentSessionId);
      const sessionToSave: ChatSession = {
        id: currentSessionId,
        title:
          existing?.title && existing.title !== 'Cuộc trò chuyện mới'
            ? existing.title
            : deriveSessionTitle(messages),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        messages,
        confirmedEvents,
        model: activeModel,
      };

      saveCurrentSession(sessionToSave);
      onSessionsChange?.();
    }
  }, [messages, confirmedEvents, currentSessionId, activeModel, onSessionsChange]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustTextareaHeight();
      }
    }, 0);
  };

  const handleClearChat = () => {
    if (typeof setMessages === 'function') {
      setMessages([]);
    }
    setConfirmedEvents({});
    const newId = generateSessionId();
    setCurrentSessionId(newId);
    setActiveSessionId(newId);
    try {
      localStorage.removeItem('calendai_chat_messages');
      localStorage.removeItem('calendai_confirmed_events');
    } catch {
      // Ignore
    }
    if (onClearSession) {
      onClearSession();
    }
    onSessionsChange?.();
  };

  const handleConfirmSuccess = useCallback((
    proposalId: string,
    event: CalendarEventResult,
    isMock?: boolean
  ) => {
    setConfirmedEvents((prev) => ({
      ...prev,
      [proposalId]: { event, isMock },
    }));
  }, []);

  const handleEditRequest = useCallback((proposal: MeetingProposalData) => {
    setInput(`Tôi muốn chỉnh sửa thông tin cuộc họp "${proposal.summary}": `);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustTextareaHeight();
      }
    }, 0);
  }, [setInput]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f8fafd] dark:bg-[#0c120f]">
      {/* Main Chat Stream Area */}
      <div className="flex flex-1 flex-col h-full min-w-0">
        {/* Scrollable messages container */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Reset chat history action bar when there are messages */}
            {messages.length > 0 && (
              <div className="flex items-center justify-end pb-1">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] hover:bg-[#fdf2f0] hover:text-[#cf3e32] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2e1917] dark:hover:text-[#fca5a5]"
                  title="Xóa session (Bắt đầu đoạn chat mới)"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Làm mới hội thoại</span>
                </button>
              </div>
            )}

            {/* Cartoon Workshop Welcome Hero when empty */}
            {messages.length === 0 && (
              <div className="my-8 flex flex-col items-start justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ede4d5] border-2 border-[#2d2015] shadow-[3px_3px_0px_#2d2015] mb-5 dark:bg-[#211a14] dark:border-[#d49439] dark:shadow-[3px_3px_0px_#d49439]">
                  <Sparkles className="h-7 w-7 text-[#c25e2e] dark:text-[#fbbf24]" />
                </div>

                <div className="flex items-center gap-2">
                  <h1
                    id="app-name"
                    className="text-3xl font-extrabold tracking-tight text-[#2b1f17] dark:text-[#f5ebd9] sm:text-4xl"
                  >
                    Calendai
                  </h1>
                  <span className="rounded-md border border-[#2d2015] bg-[#ede4d5] px-2 py-0.5 text-[11px] font-bold text-[#c25e2e] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24]">
                    CHRONO-ATELIER
                  </span>
                </div>
                <p className="mt-1.5 text-xl font-medium text-[#786455] dark:text-[#ba9f88] sm:text-2xl">
                  Tôi có thể giúp bạn lên lịch cuộc họp nào hôm nay?
                </p>

                {/* Quick suggestion cards styled as vintage ticket vouchers */}
                <div className="mt-8 grid w-full grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handlePromptClick(item.prompt)}
                      className={`flex flex-col justify-between rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${item.cardStyle}`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`rounded-sm border px-1.5 py-0.2 text-[11px] font-mono font-bold tracking-wider ${item.accentBadge}`}>
                            {item.tag}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                          {item.title}
                        </span>
                        <p className="mt-1 text-xs text-[#786455] dark:text-[#ba9f88] line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                      <div className={`mt-4 flex items-center justify-end font-bold ${item.arrowColor}`}>
                        <ArrowUp className="h-4 w-4 rotate-45" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list (memoized to eliminate re-rendering completed messages on streaming) */}
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              const proposalInvocation = message.toolInvocations?.find(
                (t) => t.toolName === 'proposeMeeting' && 'result' in t
              );
              const proposalId =
                proposalInvocation && 'result' in proposalInvocation
                  ? (proposalInvocation.result as MeetingProposalData | undefined)?.proposalId
                  : undefined;
              const confirmed = proposalId ? confirmedEvents[proposalId] : undefined;

              return (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isLast={isLast}
                  isLoading={isLoading}
                  error={error}
                  confirmedEvent={confirmed}
                  onConfirmSuccess={handleConfirmSuccess}
                  onEditRequest={handleEditRequest}
                  onReload={reload}
                />
              );
            })}

            {/* Pending assistant thinking state right after user submits message */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-3 flex-row">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-[#ede4d5] border-2 border-[#2d2015] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:bg-[#211a14] dark:border-[#d49439] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="w-fit max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-tl-xs bg-[#fffaf2] px-5 py-3.5 text-sm text-[#2b1f17] border-2 border-[#2d2015] shadow-[2px_2px_0px_#2d2015] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:border-[#453427] dark:shadow-[2px_2px_0px_#453427]">
                  <div className="flex items-center gap-2.5 py-0.5 text-xs text-[#786455] dark:text-[#ba9f88]">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#c25e2e] animate-pulse dark:bg-[#e07a3f]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d49439] animate-pulse [animation-delay:150ms] dark:bg-[#fbbf24]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1f7560] animate-pulse [animation-delay:300ms] dark:bg-[#2dd4bf]" />
                    </span>
                    <span className="font-semibold text-[#2b1f17] dark:text-[#f5ebd9]">
                      Calendai đang suy nghĩ...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="flex items-center justify-between rounded-2xl border-2 border-[#cf3e32] bg-[#fdf2f0] p-3.5 text-xs text-[#a63024] shadow-[2px_2px_0px_#cf3e32] dark:border-[#ef4444] dark:bg-[#2b1614] dark:text-[#f87171] dark:shadow-[2px_2px_0px_#ef4444]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#cf3e32] dark:text-[#ef4444]" />
                  <span>
                    {error.message || 'Đã có lỗi xảy ra trong quá trình phản hồi.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => reload()}
                  className="font-bold text-[#cf3e32] underline hover:no-underline dark:text-[#f87171]"
                >
                  Thử lại
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Bottom Input Bar (Typewriter Console styling) */}
        <div className="shrink-0 border-t-2 border-[#2d2015]/60 bg-[#fffaf2]/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 backdrop-blur-md transition-colors dark:border-[#453427] dark:bg-[#181310]/95">
          {/* Workbench Control Bar: Model Selector, Tips & Chronometer Timezone */}
          <div className="mx-auto flex max-w-3xl items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              {onSelectModel && (
                <ModelSelector
                  selectedModel={activeModel}
                  onSelectModel={onSelectModel}
                />
              )}
              <button
                type="button"
                onClick={toggleTips}
                className="flex min-h-[30px] sm:min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-2.5 py-0.5 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]"
                title="Xem mẹo đặt lịch & tham số"
                aria-label="Xem mẹo đặt lịch"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#d49439] dark:text-[#fbbf24]" />
                <span className="hidden xs:inline">Mẹo đặt lịch</span>
              </button>
            </div>

            {/* Chronometer Timezone Badge */}
            <div className="flex items-center gap-1.5 rounded-full border-2 border-[#2d2015]/30 bg-[#f5eee1] px-2.5 py-0.5 text-[11px] font-mono font-semibold text-[#786455] dark:border-[#453427] dark:bg-[#16120f] dark:text-[#ba9f88]">
              <Globe className="h-3 w-3 text-[#c25e2e] dark:text-[#e07a3f]" />
              <span>Hà Nội (GMT+7)</span>
            </div>
          </div>

          <form
            onSubmit={onFormSubmit}
            className="mx-auto flex max-w-3xl items-end rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] px-3 sm:px-4 py-2 shadow-[3px_3px_0px_#2d2015] focus-within:shadow-[4px_4px_0px_#c25e2e] transition-all dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[3px_3px_0px_#453427] dark:focus-within:border-[#e07a3f] dark:focus-within:shadow-[4px_4px_0px_#e07a3f]"
          >
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full text-[#786455] hover:bg-[#fdf2f0] hover:text-[#cf3e32] transition-all active:scale-95 mb-0.5 mr-1.5 sm:mr-2 dark:text-[#ba9f88] dark:hover:bg-[#2b1111] dark:hover:text-[#fca5a5]"
                title="Xóa session (Bắt đầu đoạn chat mới)"
                aria-label="Xóa session"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)"
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm text-[#2b1f17] placeholder:text-[#786455] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50 max-h-36 overflow-y-auto leading-relaxed dark:text-[#f5ebd9] dark:placeholder:text-[#ba9f88]"
              style={{ height: 'auto' }}
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] sm:h-9.5 sm:w-9.5 touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#c25e2e] text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed mb-0.5 ml-1.5 sm:ml-2 dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#f59e0b]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </form>

          <div className="mx-auto mt-2 flex max-w-3xl flex-col items-center justify-between gap-1 text-[11px] text-[#786455] sm:flex-row dark:text-[#ba9f88]">
            <span className="text-center sm:text-left">
              ⚙️ Calendai Chrono-Engine • Google Calendar & Meet
            </span>
            <div className="flex items-center gap-1.5">
              <Link
                href="/privacy"
                className="rounded-md px-1.5 py-0.5 text-[#786455] hover:bg-[#ede4d5] hover:text-[#c25e2e] transition-colors dark:text-[#ba9f88] dark:hover:bg-[#211a14] dark:hover:text-[#e07a3f]"
              >
                Chính sách
              </Link>
              <span>•</span>
              <Link
                href="/terms"
                className="rounded-md px-1.5 py-0.5 text-[#786455] hover:bg-[#ede4d5] hover:text-[#c25e2e] transition-colors dark:text-[#ba9f88] dark:hover:bg-[#211a14] dark:hover:text-[#e07a3f]"
              >
                Điều khoản
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Right Sidenote Sidebar (Slide in when isTipsOpen is true) */}
      {isTipsOpen && (
        <aside className="hidden lg:flex w-84 xl:w-92 flex-col border-l border-[#dadce0] bg-white h-full overflow-y-auto p-5 shrink-0 animate-in slide-in-from-right duration-200 dark:border-[#23382d] dark:bg-[#16221d]">
          <Sidenote
            onUsePrompt={handlePromptClick}
            onClearChat={handleClearChat}
            hasMessages={messages.length > 0}
            onClose={toggleTips}
          />
        </aside>
      )}

      {/* Mobile Sidenote Modal / Bottom Sheet Drawer */}
      {isTipsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs lg:hidden animate-in fade-in duration-150">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl border-t sm:border border-[#dadce0] overflow-y-auto dark:bg-[#16221d] dark:border-[#23382d]">
            <div className="w-10 h-1 bg-[#dadce0] dark:bg-[#23382d] rounded-full mx-auto mb-3 shrink-0 sm:hidden" />
            <Sidenote
              onUsePrompt={(prompt) => {
                handlePromptClick(prompt);
                toggleTips();
              }}
              onClearChat={() => {
                handleClearChat();
                toggleTips();
              }}
              hasMessages={messages.length > 0}
              onClose={toggleTips}
            />
          </div>
        </div>
      )}
    </div>
  );
}
