'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Bell, RefreshCw, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/loops', label: 'Loops', icon: ListChecks },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/routines', label: 'Routines', icon: RefreshCw },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

/** Floating glass bottom tab bar. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="pos-glass flex w-full max-w-md items-center justify-between rounded-pill px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'pos-focus mx-auto flex h-12 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-pill px-3 text-[0.625rem]',
                  'transition-colors duration-pos ease-pos',
                  active ? 'text-gold-on bg-gold' : 'text-muted hover:text-text',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
