'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/types';
import {
  type ChatSession,
  createNewSession,
  deleteSessionById,
  getActiveSessionId,
  loadAllSessions,
  setActiveSessionId,
} from '@/lib/chat/session-storage';
import { ChatInterface } from '@/components/ChatInterface';
import { ChatSidebar } from '@/components/ChatSidebar';
import { Header } from '@/components/Header';

// Lazy-load modals to reduce initial bundle size
const UpcomingEventsModal = dynamic(
  () => import('@/components/UpcomingEventsModal').then((mod) => mod.UpcomingEventsModal),
  { ssr: false }
);

const ChatHistoryModal = dynamic(
  () => import('@/components/ChatHistoryModal').then((mod) => mod.ChatHistoryModal),
  { ssr: false }
);

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast notification after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  // Open sidebar by default on large desktop screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Load chat sessions on mount
  useEffect(() => {
    const all = loadAllSessions();
    setSessions(all);
    const active = getActiveSessionId() || all[0]?.id || null;
    setActiveSessionIdState(active);
  }, []);

  const refreshSessions = useCallback(() => {
    const all = loadAllSessions();
    setSessions(all);
  }, []);

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('calendai_selected_model');
      if (savedModel && typeof savedModel === 'string') {
        setSelectedModel(savedModel);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem('calendai_selected_model', modelId);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setActiveSessionIdState(session.id);
    setChatKey((prev) => prev + 1);
  };

  const handleNewSession = () => {
    const newSession = createNewSession(selectedModel);
    refreshSessions();
    setActiveSessionIdState(newSession.id);
    setChatKey((prev) => prev + 1);
    setToast({
      type: 'success',
      message: 'Đã tạo cuộc trò chuyện mới.',
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    const { remainingSessions, newActiveId } = deleteSessionById(sessionId);
    setSessions(remainingSessions);
    if (activeSessionId === sessionId) {
      setActiveSessionIdState(newActiveId);
      setChatKey((prev) => prev + 1);
    }
    setToast({
      type: 'success',
      message: 'Đã xóa phiên chat.',
    });
  };

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
      setUser(data.user);
      setIsConfigured(data.isConfigured !== false);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    fetchAuthStatus();

    // Check URL parameters for OAuth redirect feedback
    const url = new URL(window.location.href);
    const authSuccess = url.searchParams.get('auth_success');
    const authError = url.searchParams.get('auth_error');

    if (authSuccess) {
      setToast({
        type: 'success',
        message: 'Kết nối tài khoản Google Calendar thành công!',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authError) {
      setToast({
        type: 'error',
        message: decodeURIComponent(authError),
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setUser(null);
      setToast({
        type: 'success',
        message: 'Đã ngắt kết nối tài khoản Google.',
      });
    } catch {
      // Ignored
    }
  };

  const handleClearSession = () => {
    handleNewSession();
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f5eee1] dark:bg-[#14110f]">
      {/* Toast notification snackbar */}
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-xs sm:text-sm font-medium shadow-[0_4px_16px_rgba(43,31,23,0.18)] border-2 ${
              toast.type === 'success'
                ? 'bg-[#f0f9f4] text-[#1f7560] border-[#2d8a57] dark:bg-[#14261d] dark:text-[#34d399] dark:border-[#2dd4bf]'
                : 'bg-[#fdf2f0] text-[#a63024] border-[#cf3e32] dark:bg-[#2b1614] dark:text-[#f87171] dark:border-[#ef4444]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1e8e3e] dark:text-[#10b981]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#ea4335]" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Đóng thông báo"
              className="ml-2 rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        isConfigured={isConfigured}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => {
          refreshSessions();
          setIsSidebarOpen((prev) => !prev);
        }}
        onOpenUpcoming={() => setIsUpcomingOpen(true)}
        onOpenHistory={() => {
          refreshSessions();
          setIsSidebarOpen((prev) => !prev);
        }}
        onOpenTips={() => setIsTipsOpen((prev) => !prev)}
        onClearSession={handleClearSession}
        onLogout={handleLogout}
      />

      {/* Main Layout Area with ChatGPT-style Left Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          onCloseMobile={() => setIsSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onOpenUpcoming={() => setIsUpcomingOpen(true)}
          onOpenTips={() => setIsTipsOpen((prev) => !prev)}
        />

        {/* Main Chat Interface */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <ChatInterface
            key={chatKey}
            isAuthenticated={isAuthenticated}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            activeSessionId={activeSessionId}
            onSessionsChange={refreshSessions}
            isTipsOpen={isTipsOpen}
            onToggleTips={() => setIsTipsOpen((prev) => !prev)}
            onClearSession={() => {
              setToast({
                type: 'success',
                message: 'Đã tạo cuộc trò chuyện mới.',
              });
            }}
          />
        </main>
      </div>

      {/* Upcoming Events Modal Drawer */}
      <UpcomingEventsModal
        isOpen={isUpcomingOpen}
        onClose={() => setIsUpcomingOpen(false)}
      />

      {/* Multi-Session History Modal Drawer (fallback / direct open) */}
      <ChatHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />
    </div>
  );
}
