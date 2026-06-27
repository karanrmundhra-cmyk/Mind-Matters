import type { ModelProvider, AIParseInput, AIParseOutput, AIDraftInput } from '@/ai/types';
import { fastPathParse } from '@/domain/parse/fastPath';

/**
 * Deterministic provider used (a) as the keyless fallback so the app still parses
 * without an API key, and (b) in tests via a canned response. It derives a reasonable
 * AIParseOutput from the deterministic fast-path — it does not call any network.
 */
export class StubProvider implements ModelProvider {
  readonly name = 'stub';
  private readonly canned?: AIParseOutput;

  constructor(canned?: AIParseOutput) {
    this.canned = canned;
  }

  async parseLoop(input: AIParseInput): Promise<AIParseOutput> {
    if (this.canned) return this.canned;
    const fp = fastPathParse(input.text, input.contacts, input.now);
    const resolvedNames = fp.ownerContactIds
      .map((id) => input.contacts.find((c) => c.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    return {
      owners: [...resolvedNames, ...fp.unresolvedOwners],
      title: fp.title,
      ask: fp.ask,
      definitionOfDone: fp.definitionOfDone,
      deadlineIso: fp.deadlineIso,
      priority: fp.priority,
      suggestedChannel: fp.suggestedChannel,
      confidence: fp.confidence,
      clarifyingQuestion: null,
    };
  }

  async draftMessage(input: AIDraftInput): Promise<string> {
    return `Hi ${input.ownerName}, following up on: ${input.ask}. Could you share an update? Thanks.`;
  }
}
