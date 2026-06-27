import type { Priority, Channel } from '@/domain/enums';
import type { ParsedLoop } from '@/domain/parse/schema';
import { parseRelativeDate } from '@/domain/parse/dates';

export interface KnownContact {
  id: string;
  name: string;
}

const PRIORITY_RULES: ReadonlyArray<[RegExp, Priority]> = [
  [/\b(urgent|asap|immediately|critical|right away|emergency)\b/i, 'Critical'],
  [/\b(important|high priority|today|priority)\b/i, 'High'],
  [/\b(whenever|no rush|low priority|sometime|eventually)\b/i, 'Low'],
];

const CHANNEL_RULES: ReadonlyArray<[RegExp, Channel]> = [
  [/\b(email|mail|e-mail)\b/i, 'email'],
  [/\b(whatsapp|wa|whats app)\b/i, 'whatsapp'],
  [/\b(call|phone|ring|dial)\b/i, 'telephone'],
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function titleFrom(ask: string): string {
  const words = ask.trim().split(/\s+/);
  return words.length <= 8 ? ask.trim() : words.slice(0, 8).join(' ') + '…';
}

function definitionFrom(text: string, ask: string): string {
  const clause = text.match(/\b(?:once|until|when|after)\b\s+(.+)$/i);
  if (clause && clause[1]) return clause[1].trim().replace(/[.?!]+$/, '');
  return `${ask.replace(/[.?!]+$/, '')} — completed`;
}

/**
 * Deterministic fast-path parser for the predictable ~80% of inputs.
 * Resolves owners only against KNOWN contacts; never invents a contact or a date.
 */
export function fastPathParse(
  text: string,
  contacts: KnownContact[],
  now: Date = new Date(),
): ParsedLoop {
  const resolved = new Map<string, string>(); // id -> name
  const unresolved = new Set<string>();

  // 1) @-mentions
  const mentions = [...text.matchAll(/@([\p{L}][\p{L}\d_'.-]*)/gu)].map((m) => m[1]!);
  for (const mention of mentions) {
    const hit = contacts.find((c) => c.name.toLowerCase().startsWith(mention.toLowerCase()));
    if (hit) resolved.set(hit.id, hit.name);
    else unresolved.add(mention);
  }

  // 2) bare known-contact names appearing in the text
  for (const c of contacts) {
    const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) resolved.set(c.id, c.name);
  }

  // Priority
  let priority: Priority = 'Medium';
  let priorityExplicit = false;
  for (const [re, p] of PRIORITY_RULES) {
    if (re.test(text)) {
      priority = p;
      priorityExplicit = true;
      break;
    }
  }

  // Channel
  let channel: Channel | null = null;
  for (const [re, c] of CHANNEL_RULES) {
    if (re.test(text)) {
      channel = c;
      break;
    }
  }

  const deadline = parseRelativeDate(text, now);

  // Ask = text minus @ symbols; keep it human.
  const ask = text.replace(/@/g, '').trim();
  const title = titleFrom(ask);
  const definitionOfDone = definitionFrom(text, ask);

  const hasOwner = resolved.size > 0;
  let confidence = 0.4;
  if (hasOwner) confidence += 0.3;
  if (deadline) confidence += 0.15;
  if (priorityExplicit) confidence += 0.15;
  if (!hasOwner && unresolved.size > 0) confidence -= 0.2; // a name was meant but unmatched

  return {
    ownerContactIds: [...resolved.keys()],
    unresolvedOwners: [...unresolved],
    title,
    ask,
    definitionOfDone,
    deadlineIso: deadline ? deadline.toISOString() : null,
    priority,
    suggestedChannel: channel,
    confidence: clamp01(confidence),
  };
}
