import {
  CircleDot,
  FileText,
  Send,
  CheckCheck,
  Eye,
  Reply,
  BellRing,
  Phone,
  ArrowRightLeft,
  Flag,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import type { TouchView } from '@/domain/loop/types';
import type { TouchType } from '@/domain/enums';

const META: Record<TouchType, { label: string; icon: LucideIcon }> = {
  created: { label: 'Loop created', icon: CircleDot },
  drafted: { label: 'Message drafted', icon: FileText },
  sent: { label: 'Message sent', icon: Send },
  delivered: { label: 'Delivered', icon: CheckCheck },
  seen: { label: 'Seen', icon: Eye },
  replied: { label: 'Replied', icon: Reply },
  reminded: { label: 'Reminder sent', icon: BellRing },
  followup_sent: { label: 'Follow-up sent', icon: BellRing },
  call_logged: { label: 'Call logged', icon: Phone },
  status_changed: { label: 'Status changed', icon: ArrowRightLeft },
  closed: { label: 'Loop closed', icon: Flag },
  note: { label: 'Note', icon: StickyNote },
};

function when(ts: Date): string {
  return ts.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** The single communication timeline for a loop (one source of truth — no separate chat). */
export function Timeline({ touches }: { touches: TouchView[] }) {
  if (touches.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute left-[11px] top-1 bottom-1 w-px bg-line" aria-hidden />
      {touches.map((t) => {
        const meta = META[t.type];
        const Icon = meta.icon;
        const detail =
          t.payload && typeof t.payload === 'object' && 'from' in t.payload && 'to' in t.payload
            ? `${String((t.payload as Record<string, unknown>).from)} → ${String((t.payload as Record<string, unknown>).to)}`
            : null;
        return (
          <li key={t.id} className="relative">
            <span className="absolute -left-6 top-0.5 flex h-6 w-6 items-center justify-center rounded-pill bg-[rgb(var(--pos-surface)/0.85)] text-gold">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-text">{meta.label}</p>
            <p className="text-xs text-muted">
              {when(t.timestamp)}
              {detail ? ` · ${detail}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
