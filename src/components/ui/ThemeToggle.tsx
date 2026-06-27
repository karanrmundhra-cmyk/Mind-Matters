'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
}

/** Light/dark toggle. Persists choice; respects the no-flash inline script in layout. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => setTheme(getInitial()), []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('pos-theme', next);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'pos-focus inline-flex h-11 w-11 items-center justify-center rounded-pill',
        'pos-glass text-text transition-transform duration-pos ease-pos active:scale-90',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
