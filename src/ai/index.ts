import type { ModelProvider } from '@/ai/types';
import { StubProvider } from '@/ai/providers/stub';
import { AnthropicProvider } from '@/ai/providers/anthropic';
import { GeminiProvider } from '@/ai/providers/gemini';

export type { ModelProvider } from '@/ai/types';

/**
 * Resolve the active model provider from config (AI_PROVIDER = anthropic | gemini).
 * If the configured provider has no credentials, fall back to the deterministic
 * StubProvider so capture NEVER breaks — the app degrades to fast-path parsing rather
 * than failing (spec: "AI unavailable → never block capture").
 */
export function getProvider(): ModelProvider {
  const provider = process.env.AI_PROVIDER ?? 'anthropic';

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY,
      fastModel: process.env.GEMINI_MODEL_FAST ?? 'gemini-2.0-flash',
      strongModel: process.env.GEMINI_MODEL_STRONG ?? 'gemini-2.0-flash',
    });
  }
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      fastModel: process.env.AI_MODEL_FAST ?? 'claude-haiku-4-5-20251001',
      strongModel: process.env.AI_MODEL_STRONG ?? 'claude-sonnet-4-6',
    });
  }
  return new StubProvider();
}

/** True when a real AI provider is configured (vs. the keyless fallback). */
export function isAiConfigured(): boolean {
  const provider = process.env.AI_PROVIDER ?? 'anthropic';
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}
