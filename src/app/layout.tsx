import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calendai — Trợ lý AI Đặt Lịch Google Calendar & Google Meet',
  description: 'Trợ lý AI tiếng Việt thông minh giúp đặt lịch hẹn Google Calendar và tự động tạo link Google Meet thông qua ngôn ngữ tự nhiên.',
  icons: {
    icon: '/assets/logo.png',
    shortcut: '/assets/logo.png',
    apple: '/assets/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
