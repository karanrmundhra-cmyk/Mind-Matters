'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Pencil } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { PRIORITIES, CHANNELS, type Priority, type Channel } from '@/domain/enums';

export interface ConfirmOwner {
  contactId: string | null; // null ⇒ not a saved contact (must be resolved before confirm)
  name: string;
}

export interface ConfirmDraft {
  owners: ConfirmOwner[];
  title: string;
  ask: string;
  definitionOfDone: string;
  deadlineIso: string | null;
  priority: Priority;
  channel: Channel | null;
  confidence: number;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 ml-1 block text-xs font-medium text-muted">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * AI Confirm card. Every field is tappable to edit; nothing is created until the user
 * taps Confirm. A wrong-contact guard blocks confirm while any owner is unresolved
 * (not a saved contact) — we never silently send to an invented contact.
 */
export function ConfirmCard({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: ConfirmDraft;
  onConfirm: (d: ConfirmDraft) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<ConfirmDraft>(draft);
  const set = <K extends keyof ConfirmDraft>(k: K, v: ConfirmDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const hasUnresolvedOwner = d.owners.some((o) => o.contactId === null);
  const hasOwner = d.owners.length > 0;
  const canConfirm = hasOwner && !hasUnresolvedOwner && d.ask.trim() !== '' && d.definitionOfDone.trim() !== '';

  const deadlineValue = d.deadlineIso ? d.deadlineIso.slice(0, 10) : '';

  return (
    <GlassCard className="animate-fade-up" role="dialog" aria-label="Confirm new loop">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3 text-text">Confirm loop</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> tap any field to edit
        </span>
      </div>

      {/* Owners */}
      <div className="mb-4">
        <span className="mb-1 ml-1 block text-xs font-medium text-muted">Owner</span>
        <div className="flex flex-wrap gap-2">
          {d.owners.map((o, i) => (
            <span
              key={`${o.name}-${i}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm',
                o.contactId
                  ? 'bg-[rgb(var(--pos-surface)/0.6)] text-text'
                  : 'border border-danger/60 text-danger',
              )}
            >
              {!o.contactId && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
              {o.name}
              {!o.contactId && <span className="text-xs">· not a saved contact</span>}
            </span>
          ))}
          {!hasOwner && <span className="text-sm text-danger">Add who owes you this.</span>}
        </div>
        {hasUnresolvedOwner && (
          <p className="mt-1.5 ml-1 text-xs text-danger" role="alert">
            Pick or add a saved contact before confirming — we won’t message an unknown contact.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Field label="Ask" value={d.ask} onChange={(v) => set('ask', v)} placeholder="What do they need to do?" />
        <Field
          label="Done when"
          value={d.definitionOfDone}
          onChange={(v) => set('definitionOfDone', v)}
          placeholder="How you’ll know it’s complete"
        />
        <label className="block">
          <span className="mb-1 ml-1 block text-xs font-medium text-muted">Deadline</span>
          <Input
            type="date"
            value={deadlineValue}
            onChange={(e) => set('deadlineIso', e.target.value ? new Date(e.target.value + 'T18:00:00.000Z').toISOString() : null)}
          />
        </label>
      </div>

      {/* Priority */}
      <div className="mt-4">
        <span className="mb-1 ml-1 block text-xs font-medium text-muted">Priority</span>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p} active={d.priority === p} onClick={() => set('priority', p)}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      {/* Channel */}
      <div className="mt-4">
        <span className="mb-1 ml-1 block text-xs font-medium text-muted">Channel</span>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Chip key={c} active={d.channel === c} onClick={() => set('channel', d.channel === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Button variant="gold" className="flex-1" disabled={!canConfirm} onClick={() => onConfirm(d)}>
          <Check className="h-4 w-4" aria-hidden /> Confirm
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
