'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isEnabled } from '@/domain/flags/flags';
import { useSpeechRecognition } from '@/components/ui/useSpeechRecognition';

/**
 * Floating bottom capture bar — type OR speak to capture a loop. Voice (gated by the
 * `voice` flag + browser support) transcribes into the editable field; nothing is parsed
 * until the user reviews the text and taps send.
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
  const voice = useSpeechRecognition();
  const showVoice = isEnabled('voice') && voice.supported;

  // Mirror live/finished transcription into the editable field (never auto-submit).
  useEffect(() => {
    if (voice.listening) {
      setValue(`${voice.transcript} ${voice.interim}`.trim());
    } else if (voice.transcript) {
      setValue(voice.transcript);
    }
  }, [voice.listening, voice.transcript, voice.interim]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onCapture?.(text);
    setValue('');
    voice.reset();
  }

  function toggleVoice() {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.reset();
      voice.start();
    }
  }

  return (
    <div className={cn('flex w-full max-w-md flex-col gap-1', className)}>
      <form onSubmit={submit} className="pos-glass flex w-full items-center gap-2 rounded-pill p-2 pl-5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={voice.listening ? 'Listening…' : placeholder}
          aria-label="Capture a loop"
          className="pos-focus h-10 flex-1 bg-transparent text-[0.95rem] text-text placeholder:text-faint focus:outline-none"
        />
        {showVoice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voice.listening ? 'Stop recording' : 'Capture by voice'}
            aria-pressed={voice.listening}
            className={cn(
              'pos-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill transition-colors duration-pos ease-pos',
              voice.listening ? 'bg-danger text-danger-on' : 'text-muted hover:text-text',
            )}
          >
            {voice.listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        <button
          type="submit"
          aria-label="Capture"
          disabled={!value.trim()}
          className="pos-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-gold text-gold-on shadow-gold-glow transition-transform duration-pos ease-pos active:scale-90 disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      {voice.error && (
        <p className="px-4 text-xs text-danger" role="alert">
          {voice.error}
        </p>
      )}
    </div>
  );
}
