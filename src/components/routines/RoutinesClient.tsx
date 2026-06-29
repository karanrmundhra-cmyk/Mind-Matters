'use client';

import { useState, useTransition } from 'react';
import { Check, Flame, Plus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { isCheckedToday, displayStreak, type RoutineState } from '@/domain/routines/streak';
import type { RoutineView } from '@/domain/loop/types';
import { checkRoutineAction, createRoutineAction } from '@/app/routines/actions';
import { DEV_TZ as TZ } from '@/lib/dev';

export function RoutinesClient({ routines }: { routines: RoutineView[] }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const now = new Date();

  // Revive Date from the server-serialized value (RSC preserves Date, but guard anyway).
  const state = (r: RoutineView): RoutineState => ({
    streakCount: r.streakCount,
    lastCheckedOn: r.lastCheckedOn ? new Date(r.lastCheckedOn) : null,
  });

  const doneToday = routines.filter((r) => isCheckedToday(state(r), now, TZ)).length;
  const bestStreak = routines.reduce((m, r) => Math.max(m, displayStreak(state(r), now, TZ)), 0);

  function check(id: string) {
    start(() => void checkRoutineAction(id));
  }
  function add() {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    start(() => void createRoutineAction(t));
  }

  return (
    <div>
      <GlassCard className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Today</p>
          <p className="text-h2 text-text">
            {doneToday}/{routines.length} <span className="text-sm font-normal text-muted">done</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-pill bg-[rgb(var(--pos-surface)/0.6)] px-4 py-2">
          <Flame className="h-5 w-5 text-gold" aria-hidden />
          <span className="text-h3 text-text">{bestStreak}</span>
          <span className="text-xs text-muted">best streak</span>
        </div>
      </GlassCard>

      <ul className="mb-5 space-y-2.5">
        {routines.map((r) => {
          const checked = isCheckedToday(state(r), now, TZ);
          const streak = displayStreak(state(r), now, TZ);
          return (
            <li key={r.id}>
              <GlassCard flush className="flex items-center gap-3 p-3.5">
                <button
                  type="button"
                  onClick={() => check(r.id)}
                  disabled={checked || pending}
                  aria-label={checked ? `${r.title} done today` : `Mark ${r.title} done`}
                  aria-pressed={checked}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border transition-colors duration-pos ease-pos',
                    checked
                      ? 'border-transparent bg-gold text-gold-on'
                      : 'border-[rgb(var(--pos-border)/0.4)] text-transparent hover:border-gold',
                  )}
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
                <span className={cn('flex-1 text-[0.95rem]', checked ? 'text-muted line-through' : 'text-text')}>
                  {r.title}
                </span>
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted">
                    <Flame className="h-4 w-4 text-gold" aria-hidden /> {streak}
                  </span>
                )}
              </GlassCard>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a daily routine…"
          aria-label="New routine title"
        />
        <Button variant="gold" onClick={add} disabled={!title.trim() || pending} aria-label="Add routine">
          <Plus className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
