'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('calendai_theme', 'dark');
      } catch {
        // Ignore localStorage error
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('calendai_theme', 'light');
      } catch {
        // Ignore localStorage error
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 min-h-[34px] min-w-[34px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:ring-2 focus-visible:ring-[#c25e2e] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b] dark:focus-visible:ring-[#e07a3f]"
      title={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối'}
      aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối'}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[#fbbf24] hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="h-4 w-4 text-[#d49439] hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
