import { z } from 'zod';
import { PRIORITIES, CHANNELS } from '@/domain/enums';

/**
 * Strict shape the parser (fast-path or AI) must produce. The AI layer is forced
 * to return exactly this; anything else is rejected. Contacts and dates are NEVER
 * invented — unmatched owners and absent deadlines stay null for the user to resolve.
 */
export const parsedLoopSchema = z.object({
  /** Resolved owners: references to known contacts by id. Empty ⇒ ask the user who. */
  ownerContactIds: z.array(z.string().uuid()),
  /** Raw owner names mentioned but NOT matched to a known contact (never invented). */
  unresolvedOwners: z.array(z.string()),
  title: z.string().min(1),
  ask: z.string().min(1),
  definitionOfDone: z.string().min(1),
  /** ISO 8601 or null. Null ⇒ no deadline detected (do not guess). */
  deadlineIso: z.string().datetime().nullable(),
  priority: z.enum(PRIORITIES),
  suggestedChannel: z.enum(CHANNELS).nullable(),
  /** 0..1 overall confidence in the extraction. */
  confidence: z.number().min(0).max(1),
});

export type ParsedLoop = z.infer<typeof parsedLoopSchema>;

/**
 * A parse result is EITHER a confident draft OR a single clarifying question.
 * Below threshold, or with a missing owner / ambiguous completion, we ask exactly
 * one question rather than guessing.
 */
export type ParseResult =
  | { kind: 'draft'; loop: ParsedLoop }
  | { kind: 'question'; question: string; partial: ParsedLoop };

/** Confidence below which we ask a clarifying question instead of presenting a draft. */
export const PARSE_CONFIDENCE_THRESHOLD = 0.6;
