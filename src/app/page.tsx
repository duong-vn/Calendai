'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/types';
import { ChatInterface } from '@/components/ChatInterface';
import { Header } from '@/components/Header';
import { UpcomingEventsModal } from '@/components/UpcomingEventsModal';

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafd]">
      {/* Toast notification snackbar */}
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transition-all">
          <div
            className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-xs sm:text-sm font-medium shadow-md border ${
              toast.type === 'success'
                ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                : 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1e8e3e]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#ea4335]" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 rounded-full p-1 hover:bg-black/5 transition-colors"
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
        onOpenUpcoming={() => setIsUpcomingOpen(true)}
        onOpenTips={() => setIsTipsOpen((prev) => !prev)}
        onLogout={handleLogout}
      />

      {/* Main Chat Interface */}
      <main className="flex-1">
        <ChatInterface
          isAuthenticated={isAuthenticated}
          isTipsOpen={isTipsOpen}
          onToggleTips={() => setIsTipsOpen((prev) => !prev)}
        />
      </main>

      {/* Upcoming Events Modal Drawer */}
      <UpcomingEventsModal
        isOpen={isUpcomingOpen}
        onClose={() => setIsUpcomingOpen(false)}
      />
    </div>
  );
}
