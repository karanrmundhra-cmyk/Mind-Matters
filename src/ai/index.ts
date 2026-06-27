import type { ModelProvider } from '@/ai/types';
import { StubProvider } from '@/ai/providers/stub';
import { AnthropicProvider } from '@/ai/providers/anthropic';

export type { ModelProvider } from '@/ai/types';

/**
 * Resolve the active model provider from config. If the configured provider has no
 * credentials, fall back to the deterministic StubProvider so capture NEVER breaks —
 * the app degrades to fast-path parsing rather than failing (spec: "AI unavailable →
 * never block capture").
 */
export function getProvider(): ModelProvider {
  const provider = process.env.AI_PROVIDER ?? 'anthropic';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (provider === 'anthropic' && apiKey) {
    return new AnthropicProvider({
      apiKey,
      fastModel: process.env.AI_MODEL_FAST ?? 'claude-haiku-4-5-20251001',
      strongModel: process.env.AI_MODEL_STRONG ?? 'claude-sonnet-4-6',
    });
  }
  return new StubProvider();
}

/** True when a real AI provider is configured (vs. the keyless fallback). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && (process.env.AI_PROVIDER ?? 'anthropic') === 'anthropic';
}
