'use client';

import { type FormEvent, useState } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Floating bottom capture bar — type or speak to capture a loop.
 * Step 0: presentational + local state. Parse/confirm wiring lands in Step 2.
 */
export function CaptureBar({
  onCapture,
  placeholder = 'Who owes you something?',
  className,
}: {
  onCapture?: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onCapture?.(text);
    setValue('');
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'pos-glass flex w-full max-w-md items-center gap-2 rounded-pill p-2 pl-5',
        className,
      )}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Capture a loop"
        className="pos-focus h-10 flex-1 bg-transparent text-[0.95rem] text-text placeholder:text-faint focus:outline-none"
      />
      <button
        type="button"
        aria-label="Capture by voice"
        className="pos-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted hover:text-text"
      >
        <Mic className="h-5 w-5" />
      </button>
      <button
        type="submit"
        aria-label="Capture"
        disabled={!value.trim()}
        className="pos-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-gold text-gold-on shadow-gold-glow transition-transform duration-pos ease-pos active:scale-90 disabled:opacity-40"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );
}
