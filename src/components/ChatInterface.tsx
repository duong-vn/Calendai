'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import {
  AlertCircle,
  Bot,
  Calendar,
  Clock,
  CornerDownLeft,
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
  'Họp nhóm dự án vào 10h sáng mai trong 45 phút',
  'Lên lịch gặp partner@company.com lúc 14:00 thứ 6 tuần này',
  'Xem các cuộc họp sắp tới của tôi',
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
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-50">
      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Welcome Screen when no messages */}
          {messages.length === 0 && (
            <div className="my-8 flex flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-4">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Xin chào! Tôi là Calendai
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
                Trợ lý AI giúp bạn lên lịch Google Calendar và tự động tạo link Google Meet bằng ngôn ngữ tự nhiên tiếng Việt.
              </p>

              {/* Quick suggestions */}
              <div className="mt-8 w-full max-w-lg space-y-2 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Gợi ý câu lệnh nhanh</span>
                </div>
                <div className="grid gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-medium text-slate-700 shadow-2xs transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-900 sm:text-sm"
                    >
                      <span>{prompt}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-blue-600 shadow-2xs'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Message Bubble Content */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] space-y-2 ${
                    isUser
                      ? 'rounded-2xl rounded-tr-xs bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm'
                      : 'rounded-2xl rounded-tl-xs border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-2xs'
                  }`}
                >
                  {message.content && (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
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
                          className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang chuẩn bị thông tin cuộc họp...</span>
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
                              className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200"
                            >
                              {res.error || 'Không thể lấy danh sách sự kiện.'}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={toolCallId}
                            className="my-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span>Danh sách sự kiện sắp tới:</span>
                            </div>
                            {res.events && res.events.length > 0 ? (
                              <div className="space-y-1.5">
                                {res.events.map((evt) => (
                                  <div
                                    key={evt.id}
                                    className="flex items-center justify-between rounded-lg bg-white p-2 text-xs border border-slate-200"
                                  >
                                    <div className="truncate pr-2">
                                      <span className="font-semibold text-slate-800">
                                        {evt.summary}
                                      </span>
                                    </div>
                                    {evt.hangoutLink && (
                                      <a
                                        href={evt.hangoutLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                                      >
                                        <Video className="h-3 w-3" />
                                        <span>Meet</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">
                                Không có sự kiện nào sắp tới trong khoảng thời gian này.
                              </p>
                            )}
                            {res.note && (
                              <p className="text-[11px] text-slate-400 italic">
                                {res.note}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={toolCallId}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                        >
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span>Đang tra cứu lịch trên Google Calendar...</span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}

          {/* Streaming Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Bot className="h-4 w-4 text-blue-600 animate-pulse" />
              <span>Calendai đang suy nghĩ...</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>
                  {error.message || 'Đã có lỗi xảy ra trong quá trình phản hồi.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="font-semibold text-rose-800 underline hover:no-underline"
              >
                Thử lại
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ví dụ: Đặt lịch họp dự án với đối tác sáng mai lúc 9h..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CornerDownLeft className="h-4 w-4" />
            )}
          </button>
        </form>

        <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Hỗ trợ tạo lịch tiếng Việt với Google Meet tự động</span>
          <span className="hidden sm:inline">Nhấn Enter để gửi</span>
        </div>
      </div>
    </div>
  );
}
