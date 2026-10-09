'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useChat } from 'ai/react';
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  Clock,
  Loader2,
  Sparkles,
  User,
  Video,
} from 'lucide-react';
import type { CalendarEventResult } from '@/lib/calendar/types';
import { EventCreatedCard } from './EventCreatedCard';
import {
  MeetingPreviewCard,
  type MeetingProposalData,
} from './MeetingPreviewCard';

const QUICK_PROMPTS = [
  {
    title: 'Họp nhóm dự án',
    desc: 'Lúc 10h sáng mai trong 45 phút có Google Meet',
    prompt: 'Họp nhóm dự án vào 10h sáng mai trong 45 phút',
  },
  {
    title: 'Gặp gỡ đối tác',
    desc: 'partner@company.com vào 14:00 thứ 6 tuần này',
    prompt: 'Lên lịch gặp partner@company.com lúc 14:00 thứ 6 tuần này',
  },
  {
    title: 'Xem lịch trình',
    desc: 'Kiểm tra các cuộc họp sắp diễn ra',
    prompt: 'Xem các cuộc họp sắp tới của tôi',
  },
];

interface ChatInterfaceProps {
  isAuthenticated: boolean;
}

export function ChatInterface({ isAuthenticated }: ChatInterfaceProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    setInput,
  } = useChat({
    api: '/api/chat',
  });

  const [confirmedEvents, setConfirmedEvents] = useState<
    Record<string, { event: CalendarEventResult; isMock?: boolean }>
  >({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleConfirmSuccess = (
    proposalId: string,
    event: CalendarEventResult,
    isMock?: boolean
  ) => {
    setConfirmedEvents((prev) => ({
      ...prev,
      [proposalId]: { event, isMock },
    }));
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#f8fafd]">
      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Gemini-inspired Welcome Hero */}
          {messages.length === 0 && (
            <div className="my-10 flex flex-col items-start justify-center">
              {/* Google 4-color Sparkle icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#dadce0] mb-5">
                <Sparkles className="h-6 w-6 text-[#1a73e8]" />
              </div>

              <h2 className="text-3xl font-medium tracking-tight text-[#1f1f1f] sm:text-4xl">
                Xin chào!
              </h2>
              <p className="mt-1 text-2xl font-normal text-[#5f6368] sm:text-3xl">
                Tôi có thể giúp bạn lên lịch cuộc họp nào hôm nay?
              </p>

              {/* Quick suggestion cards (Bento style like Gemini) */}
              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                {QUICK_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handlePromptClick(item.prompt)}
                    className="flex flex-col justify-between rounded-2xl border border-[#dadce0] bg-white p-4 text-left shadow-2xs transition-all hover:bg-[#f8fafd] hover:border-[#1a73e8] hover:shadow-xs"
                  >
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f]">
                        {item.title}
                      </span>
                      <p className="mt-1 text-xs text-[#5f6368] line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-end text-[#1a73e8]">
                      <ArrowUp className="h-4 w-4 rotate-45" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isLast = index === messages.length - 1;
            const isEmptyAssistant =
              !isUser &&
              !message.content &&
              (!message.toolInvocations || message.toolInvocations.length === 0);

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isUser
                      ? 'bg-[#1a73e8] text-white shadow-xs'
                      : 'bg-white border border-[#dadce0] text-[#1a73e8] shadow-xs'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] space-y-2.5 ${
                    isUser
                      ? 'rounded-2xl rounded-tr-xs bg-[#e8f0fe] px-4 py-3 text-sm text-[#1f1f1f] border border-[#d2e3fc]'
                      : 'rounded-2xl rounded-tl-xs bg-white px-5 py-3.5 text-sm text-[#1f1f1f] border border-[#dadce0] shadow-2xs'
                  }`}
                >
                  {message.content && (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  )}

                  {/* Empty Assistant State: Thinking animation if loading, fallback retry if completed empty */}
                  {isEmptyAssistant && (
                    isLoading && isLast ? (
                      <div className="flex items-center gap-2.5 py-0.5 text-xs text-[#5f6368]">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce" />
                        </span>
                        <span className="font-medium text-[#444746]">
                          Calendai đang suy nghĩ...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 text-xs text-[#5f6368]">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-[#ea4335] shrink-0" />
                          <span>Chưa nhận được phản hồi từ trợ lý AI.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => reload()}
                          className="font-medium text-[#1a73e8] hover:underline shrink-0"
                        >
                          Thử lại
                        </button>
                      </div>
                    )
                  )}

                  {/* Tool Invocations */}
                  {message.toolInvocations?.map((toolInvocation) => {
                    const { toolName, toolCallId } = toolInvocation;

                    if (toolName === 'proposeMeeting') {
                      if ('result' in toolInvocation) {
                        const proposal = toolInvocation.result as MeetingProposalData;
                        const confirmed = confirmedEvents[proposal.proposalId];

                        if (confirmed) {
                          return (
                            <EventCreatedCard
                              key={toolCallId}
                              event={confirmed.event}
                              isMock={confirmed.isMock}
                            />
                          );
                        }

                        return (
                          <MeetingPreviewCard
                            key={toolCallId}
                            proposal={proposal}
                            onConfirmSuccess={(event, isMock) =>
                              handleConfirmSuccess(proposal.proposalId, event, isMock)
                            }
                            onEditRequest={() => {
                              setInput(
                                `Tôi muốn chỉnh sửa thông tin cuộc họp "${proposal.summary}": `
                              );
                              inputRef.current?.focus();
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          key={toolCallId}
                          className="flex items-center gap-2 rounded-xl bg-[#f0f4f9] p-3 text-xs text-[#1a73e8]"
                        >
                          <Loader2 className="h-4 w-4 animate-spin text-[#1a73e8]" />
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
                              className="rounded-xl bg-[#fef7e0] p-3 text-xs text-[#b06000] border border-[#feefc3]"
                            >
                              {res.error || 'Không thể lấy danh sách sự kiện.'}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={toolCallId}
                            className="my-2 space-y-2 rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-4"
                          >
                            <div className="flex items-center gap-2 text-xs font-medium text-[#1f1f1f]">
                              <Calendar className="h-4 w-4 text-[#1a73e8]" />
                              <span>Sự kiện sắp diễn ra trên Google Calendar:</span>
                            </div>
                            {res.events && res.events.length > 0 ? (
                              <div className="space-y-1.5 pt-1">
                                {res.events.map((evt) => (
                                  <div
                                    key={evt.id}
                                    className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs border border-[#dadce0]"
                                  >
                                    <div className="truncate pr-2">
                                      <span className="font-medium text-[#1f1f1f]">
                                        {evt.summary}
                                      </span>
                                    </div>
                                    {evt.hangoutLink && (
                                      <a
                                        href={evt.hangoutLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-0.5 text-[11px] font-medium text-[#137333] hover:underline"
                                      >
                                        <Video className="h-3 w-3" />
                                        <span>Meet</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[#5f6368] italic">
                                Không có sự kiện nào sắp tới trong khoảng thời gian này.
                              </p>
                            )}
                            {res.note && (
                              <p className="text-[11px] text-[#747775] italic">
                                {res.note}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={toolCallId}
                          className="flex items-center gap-2 rounded-xl bg-[#f0f4f9] p-3 text-xs text-[#5f6368]"
                        >
                          <Loader2 className="h-4 w-4 animate-spin text-[#1a73e8]" />
                          <span>Đang tra cứu Google Calendar...</span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}

          {/* Pending assistant thinking state right after user submits message */}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-start gap-3 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium bg-white border border-[#dadce0] text-[#1a73e8] shadow-xs">
                <Sparkles className="h-4 w-4 text-[#1a73e8]" />
              </div>
              <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-tl-xs bg-white px-5 py-3.5 text-sm text-[#1f1f1f] border border-[#dadce0] shadow-2xs">
                <div className="flex items-center gap-2.5 py-0.5 text-xs text-[#5f6368]">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8] animate-bounce" />
                  </span>
                  <span className="font-medium text-[#444746]">
                    Calendai đang suy nghĩ...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center justify-between rounded-2xl border border-[#fad2cf] bg-[#fce8e6] p-3.5 text-xs text-[#c5221f]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#ea4335]" />
                <span>
                  {error.message || 'Đã có lỗi xảy ra trong quá trình phản hồi.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="font-medium text-[#c5221f] underline hover:no-underline"
              >
                Thử lại
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Input Bar (Gemini Style) */}
      <div className="p-4 sm:p-5">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center rounded-3xl border border-[#dadce0] bg-white px-4 py-2 shadow-xs transition-shadow focus-within:border-[#1a73e8] focus-within:shadow-md"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Đặt lịch họp (VD: Họp dự án sáng mai 9h có Meet...)"
            disabled={isLoading}
            className="flex-1 bg-transparent py-2 text-sm text-[#1f1f1f] placeholder:text-[#747775] focus:outline-hidden disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-white transition-colors hover:bg-[#1557b0] disabled:bg-[#dadce0] disabled:text-[#80868b] disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </form>

        <div className="mx-auto mt-2.5 flex max-w-3xl flex-col items-center justify-between gap-1 text-[11px] text-[#747775] sm:flex-row">
          <span>Calendai tự động tạo sự kiện Google Calendar & Google Meet</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-[#1a73e8] hover:underline">
              Chính sách quyền riêng tư
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-[#1a73e8] hover:underline">
              Điều khoản dịch vụ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
