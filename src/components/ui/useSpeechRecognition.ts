'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal typing for the (non-standard) Web Speech API we rely on — keeps us off `any`. */
interface SpeechAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechResult {
  readonly length: number;
  isFinal: boolean;
  0: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceState {
  supported: boolean;
  listening: boolean;
  /** Finalised transcript so far. */
  transcript: string;
  /** Live (not-yet-final) words. */
  interim: string;
  confidence: number | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Speech-to-text via the browser's Web Speech API. Never auto-acts: the caller shows the
 * transcript for the user to edit before parsing (spec: voice UX). Degrades gracefully
 * (`supported=false`) where the API is unavailable.
 */
export function useSpeechRecognition(lang = 'en-IN'): VoiceState {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(getConstructor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) {
      setError('Voice input is not supported on this device.');
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      let conf: number | null = null;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alt = result[0];
        if (result.isFinal) {
          finalText += alt.transcript;
          conf = alt.confidence;
        } else {
          interimText += alt.transcript;
        }
      }
      if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}`.trim() : finalText.trim()));
      setInterim(interimText);
      if (conf !== null) setConfidence(conf);
    };
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone permission denied.' : `Voice error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const reset = useCallback(() => {
    recRef.current?.abort();
    setListening(false);
    setTranscript('');
    setInterim('');
    setConfidence(null);
    setError(null);
  }, []);

  return { supported, listening, transcript, interim, confidence, error, start, stop, reset };
}
