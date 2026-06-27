import { Mail, MessageCircle, Phone, Send, Smartphone, Mic, type LucideIcon } from 'lucide-react';
import type { Channel } from '@/domain/enums';

export const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  email: Mail,
  whatsapp: MessageCircle,
  telephone: Phone,
  telegram: Send,
  sms: Smartphone,
  voice: Mic,
};

/** Short, human deadline label relative to now. */
export function formatDeadline(deadline: Date | null, now: Date = new Date()): string | null {
  if (!deadline) return null;
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 7) return `In ${days}d`;
  return deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Initials for an owner avatar. */
export function initials(name: string): string {
  const parts = name.replace(/[()]/g, '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function isOverdue(deadline: Date | null, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return deadline.getTime() < now.getTime();
}
