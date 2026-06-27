import { z } from 'zod';
import { PRIORITIES, CHANNELS } from '@/domain/enums';
import type { KnownContact } from '@/domain/parse/fastPath';

/** Input handed to a model provider for parsing a captured utterance. */
export interface AIParseInput {
  text: string;
  contacts: KnownContact[];
  now: Date;
}

/**
 * Exactly what a model provider must return for a parse. Owners are NAMES the model
 * believes are responsible — they are resolved against known contacts downstream
 * (names are never fabricated into contacts here). `clarifyingQuestion` lets the model
 * signal genuine ambiguity instead of guessing.
 */
export const aiParseOutputSchema = z.object({
  owners: z.array(z.string()),
  title: z.string().min(1),
  ask: z.string().min(1),
  definitionOfDone: z.string().min(1),
  deadlineIso: z.string().datetime().nullable(),
  priority: z.enum(PRIORITIES),
  suggestedChannel: z.enum(CHANNELS).nullable(),
  confidence: z.number().min(0).max(1),
  clarifyingQuestion: z.string().nullable(),
});

export type AIParseOutput = z.infer<typeof aiParseOutputSchema>;

/** Input for drafting a message in the user's voice (Step 2/7 — draft on send). */
export interface AIDraftInput {
  ask: string;
  ownerName: string;
  channel: string;
  tone?: string;
}

/**
 * The model-abstraction boundary. Every AI call goes through a ModelProvider so the
 * provider can be swapped by config without touching business logic. Implementations:
 * `StubProvider` (deterministic, keyless) and `AnthropicProvider` (live).
 */
export interface ModelProvider {
  readonly name: string;
  parseLoop(input: AIParseInput): Promise<AIParseOutput>;
  draftMessage(input: AIDraftInput): Promise<string>;
}
