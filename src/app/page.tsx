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
      // Clean query params from URL
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Toast notification banner */}
      {toast && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-0.5 hover:bg-white/20 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        isConfigured={isConfigured}
        onOpenUpcoming={() => setIsUpcomingOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Chat Interface */}
      <main className="flex-1">
        <ChatInterface isAuthenticated={isAuthenticated} />
      </main>

      {/* Upcoming Events Modal Drawer */}
      <UpcomingEventsModal
        isOpen={isUpcomingOpen}
        onClose={() => setIsUpcomingOpen(false)}
      />
    </div>
  );
}
