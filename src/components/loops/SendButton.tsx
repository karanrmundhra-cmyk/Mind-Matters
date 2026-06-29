'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Channel } from '@/domain/enums';
import { sendLoopAction } from '@/app/loops/actions';

const LABEL: Partial<Record<Channel, string>> = {
  email: 'Draft email',
  whatsapp: 'Message on WhatsApp',
  telephone: 'Call',
};

/**
 * Assisted-send button. Drafts the message server-side, then opens the user's own
 * mail/phone/WhatsApp client via a deep link — the user reviews and sends. Never autonomous.
 */
export function SendButton({ loopId, channel }: { loopId: string; channel: Channel }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    start(async () => {
      const res = await sendLoopAction(loopId, channel);
      if (res.ok && res.href) {
        window.location.href = res.href; // opens mail/tel/WhatsApp client
        router.refresh();
      } else {
        setError(res.reason ?? 'Could not prepare the message');
      }
    });
  }

  return (
    <div>
      <Button variant="gold" className="w-full" loading={pending} onClick={send}>
        <Send className="h-4 w-4" aria-hidden /> {LABEL[channel] ?? 'Send'}
      </Button>
      {error && (
        <p className="mt-2 text-center text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
