import type { AIParseInput } from '@/ai/types';

/**
 * Versioned parse prompt. Store prompts as versioned files for regression testing,
 * A/B, and rollback. Bump PARSE_PROMPT_VERSION on any wording change and log it.
 */
export const PARSE_PROMPT_VERSION = 'parse@1.0.0';

export const PARSE_PROMPT_CHANGELOG = [
  { version: 'parse@1.0.0', date: '2026-06-28', note: 'Initial parse prompt.' },
];

const SYSTEM = `You convert a short delegation utterance into a structured "loop".
A loop must have an OWNER (who must act), an ASK (the expected action), and a DEFINITION OF DONE.

Rules — follow exactly:
- Return ONLY JSON matching the schema. No prose.
- NEVER invent a person who is not named in the utterance. Put any named owners in "owners" as the
  literal names used; do not add owners that were not mentioned.
- NEVER invent a deadline. If no date/time is expressed, set "deadlineIso" to null.
- If the owner, the action, or the definition of done is genuinely ambiguous or missing, set
  "clarifyingQuestion" to ONE short question and lower "confidence". Otherwise set it to null.
- priority ∈ Critical|High|Medium|Low (default Medium unless urgency is expressed).
- suggestedChannel ∈ email|whatsapp|telephone|telegram|sms|voice or null.
- "confidence" is your 0..1 confidence in the extraction.`;

export function buildParseMessages(input: AIParseInput): {
  system: string;
  user: string;
} {
  const contactList = input.contacts.map((c) => c.name).join(', ') || '(none known yet)';
  const user = `Known contacts: ${contactList}
Current time (ISO): ${input.now.toISOString()}
Utterance: """${input.text}"""

Return JSON with keys: owners (string[]), title, ask, definitionOfDone, deadlineIso (ISO or null),
priority, suggestedChannel (or null), confidence (0..1), clarifyingQuestion (string or null).`;
  return { system: SYSTEM, user };
}
