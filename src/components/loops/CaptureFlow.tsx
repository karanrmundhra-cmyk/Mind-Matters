'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { CaptureBar } from '@/components/ui/CaptureBar';
import { ConfirmCard, type ConfirmDraft } from '@/components/loops/ConfirmCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { parseLoop } from '@/domain/parse/orchestrator';
import { StubProvider } from '@/ai/providers/stub';
import type { ContactView } from '@/domain/loop/types';
import { createLoopAction } from '@/app/loops/actions';

type Phase = { kind: 'idle' } | { kind: 'confirm'; draft: ConfirmDraft };

/**
 * Capture → AI parse → Confirm → create, end-to-end. Parsing runs through the same
 * orchestrator the server uses; here it uses the keyless StubProvider so the flow works
 * without an API key. Nothing is created until the user taps Confirm.
 */
export function CaptureFlow({ contacts }: { contacts: ContactView[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [question, setQuestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const known = contacts.map((c) => ({ id: c.id, name: c.name }));
  const nameOf = (id: string) => contacts.find((c) => c.id === id)?.name ?? 'Unknown';

  async function onCapture(text: string) {
    setBusy(true);
    setQuestion(null);
    try {
      const result = await parseLoop(text, known, { provider: new StubProvider() });
      if (result.kind === 'draft') {
        const l = result.loop;
        setPhase({
          kind: 'confirm',
          draft: {
            owners: l.ownerContactIds.map((id) => ({ contactId: id, name: nameOf(id) })),
            title: l.title,
            ask: l.ask,
            definitionOfDone: l.definitionOfDone,
            deadlineIso: l.deadlineIso,
            priority: l.priority,
            channel: l.suggestedChannel,
            confidence: l.confidence,
          },
        });
      } else {
        setQuestion(result.question);
      }
    } finally {
      setBusy(false);
    }
  }

  function onConfirm(d: ConfirmDraft) {
    startTransition(async () => {
      const id = await createLoopAction({
        owners: d.owners
          .filter((o) => o.contactId)
          .map((o) => ({ contactId: o.contactId as string, name: o.name })),
        title: d.title,
        ask: d.ask,
        definitionOfDone: d.definitionOfDone,
        deadlineIso: d.deadlineIso,
        priority: d.priority,
        channel: d.channel,
      });
      setPhase({ kind: 'idle' });
      router.push(`/loops/${id}`);
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      {phase.kind === 'confirm' && (
        <ConfirmCard draft={phase.draft} onConfirm={onConfirm} onCancel={() => setPhase({ kind: 'idle' })} />
      )}

      {phase.kind === 'idle' && question && (
        <GlassCard flush className="flex w-full items-start gap-2 p-3.5" role="status">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <p className="flex-1 text-sm text-text">{question}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setQuestion(null)}
            className="pos-focus text-muted hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </GlassCard>
      )}

      {phase.kind === 'idle' && (
        <CaptureBar
          onCapture={onCapture}
          placeholder={busy || pending ? 'Thinking…' : 'Who owes you something?'}
        />
      )}
    </div>
  );
}
