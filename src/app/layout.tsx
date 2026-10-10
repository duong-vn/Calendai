import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calendai',
  applicationName: 'Calendai',
  description: 'Trợ lý AI tiếng Việt thông minh giúp đặt lịch hẹn Google Calendar và tự động tạo link Google Meet thông qua ngôn ngữ tự nhiên.',
  openGraph: {
    title: 'Calendai',
    siteName: 'Calendai',
    description: 'Trợ lý AI tiếng Việt thông minh giúp đặt lịch hẹn Google Calendar và tự động tạo link Google Meet thông qua ngôn ngữ tự nhiên.',
    type: 'website',
  },
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
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('calendai_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-[#f8fafd] text-[#1f1f1f] dark:bg-[#101714] dark:text-[#f1f5f9] antialiased">
        {children}
      </body>
    </html>
  );
}
