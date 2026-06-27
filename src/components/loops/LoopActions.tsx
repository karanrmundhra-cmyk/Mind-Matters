'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { canQuickClose } from '@/domain/loop/stateMachine';
import type { LoopStatus } from '@/domain/enums';
import { closeLoopAction, advanceLoopAction } from '@/app/loops/actions';

const TERMINAL: ReadonlySet<LoopStatus> = new Set<LoopStatus>(['Closed', 'Dropped', 'Archived', 'Deleted']);

export function LoopActions({ loopId, status }: { loopId: string; status: LoopStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) => start(() => fn().then(() => router.refresh()));

  if (TERMINAL.has(status)) {
    return <p className="text-sm text-muted">This loop is {status.toLowerCase()}.</p>;
  }

  return (
    <div className="flex gap-3">
      {canQuickClose(status) && (
        <Button variant="gold" className="flex-1" loading={pending} onClick={() => run(() => closeLoopAction(loopId))}>
          <Check className="h-4 w-4" aria-hidden /> Mark closed
        </Button>
      )}
      <Button variant="ghost" loading={pending} onClick={() => run(() => advanceLoopAction(loopId, 'Dropped'))}>
        <XCircle className="h-4 w-4" aria-hidden /> Drop
      </Button>
    </div>
  );
}
