import type { ModelProvider, AIParseOutput } from '@/ai/types';
import type { KnownContact } from '@/domain/parse/fastPath';
import { fastPathParse } from '@/domain/parse/fastPath';
import { resolveOwnerNames } from '@/domain/parse/resolveOwners';
import {
  type ParsedLoop,
  type ParseResult,
  PARSE_CONFIDENCE_THRESHOLD,
} from '@/domain/parse/schema';

export interface ParseDeps {
  provider: ModelProvider;
  now?: Date;
}

function deadlineIsPast(deadlineIso: string | null, now: Date): boolean {
  return deadlineIso !== null && new Date(deadlineIso).getTime() < now.getTime();
}

function ownerQuestion(unresolved: string[]): string {
  if (unresolved.length === 1) {
    return `I don’t recognise “${unresolved[0]}”. Who should own this — pick or add a contact.`;
  }
  return 'Who owes you this? Pick or add a contact.';
}

function aiToCandidate(ai: AIParseOutput, contacts: KnownContact[]): ParsedLoop {
  const { ownerContactIds, unresolvedOwners } = resolveOwnerNames(ai.owners, contacts);
  return {
    ownerContactIds,
    unresolvedOwners,
    title: ai.title,
    ask: ai.ask,
    definitionOfDone: ai.definitionOfDone,
    deadlineIso: ai.deadlineIso,
    priority: ai.priority,
    suggestedChannel: ai.suggestedChannel,
    confidence: ai.confidence,
  };
}

/** Apply the product rules to a candidate to produce a draft or ONE clarifying question. */
function decide(candidate: ParsedLoop, now: Date, aiQuestion: string | null): ParseResult {
  if (aiQuestion) return { kind: 'question', question: aiQuestion, partial: candidate };
  if (candidate.ownerContactIds.length === 0) {
    return { kind: 'question', question: ownerQuestion(candidate.unresolvedOwners), partial: candidate };
  }
  if (deadlineIsPast(candidate.deadlineIso, now)) {
    return {
      kind: 'question',
      question: 'That deadline looks like it’s already passed — what date should I use?',
      partial: candidate,
    };
  }
  if (candidate.confidence < PARSE_CONFIDENCE_THRESHOLD) {
    return {
      kind: 'question',
      question: `Quick check — is this right: “${candidate.ask}”?`,
      partial: candidate,
    };
  }
  return { kind: 'draft', loop: candidate };
}

/**
 * Parse a captured utterance into a loop draft or one clarifying question.
 *
 * Deterministic fast-path handles the confident, owner-resolved, future-dated ~80%
 * with NO model call. Otherwise the model provider fills gaps, owners are re-resolved
 * against known contacts (never invented), and the product rules decide draft-vs-question.
 */
export async function parseLoop(
  text: string,
  contacts: KnownContact[],
  deps: ParseDeps,
): Promise<ParseResult> {
  const now = deps.now ?? new Date();
  const fp = fastPathParse(text, contacts, now);

  const fastPathConfident =
    fp.ownerContactIds.length > 0 &&
    fp.confidence >= PARSE_CONFIDENCE_THRESHOLD &&
    !deadlineIsPast(fp.deadlineIso, now);

  if (fastPathConfident) {
    return { kind: 'draft', loop: fp };
  }

  const ai = await deps.provider.parseLoop({ text, contacts, now });
  const candidate = aiToCandidate(ai, contacts);
  return decide(candidate, now, ai.clarifyingQuestion);
}
