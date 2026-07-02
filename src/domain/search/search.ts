import type { Loop, ContactView } from '@/domain/loop/types';
import { isClosed } from '@/domain/loop/stateMachine';

/** Normalise + tokenise a query into lowercase terms. */
function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function fieldScore(haystack: string, qterms: string[], weight: number): number {
  const h = haystack.toLowerCase();
  let score = 0;
  for (const t of qterms) {
    if (!t) continue;
    if (h.includes(t)) score += weight;
    // word-boundary match scores extra
    if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h)) score += weight * 0.5;
  }
  return score;
}

/**
 * Full-text-ish ranked search over loops. Matches title (highest), ask, owner names,
 * and definition-of-done, with a small recency boost and a slight demotion for closed
 * loops. Pure; the service/UI calls this — no business rules here beyond ranking.
 */
export function searchLoops(loops: Loop[], query: string, now: Date = new Date()): Loop[] {
  const qterms = terms(query);
  if (qterms.length === 0) return [];

  const scored = loops
    .map((loop) => {
      let score = 0;
      score += fieldScore(loop.title, qterms, 4);
      score += fieldScore(loop.ask, qterms, 2);
      score += fieldScore(loop.definitionOfDone, qterms, 1);
      score += fieldScore(loop.owners.map((o) => o.name).join(' '), qterms, 2);
      if (score === 0) return null;
      // recency boost: more recent createdAt ranks slightly higher
      const ageDays = Math.max(0, (now.getTime() - loop.createdAt.getTime()) / 86_400_000);
      score += Math.max(0, 2 - ageDays * 0.05);
      if (isClosed(loop.status)) score -= 1; // gently demote already-closed loops
      return { loop, score };
    })
    .filter((x): x is { loop: Loop; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.loop);
}

/** Ranked search over contacts (name highest, then email/phones). */
export function searchContacts(contacts: ContactView[], query: string): ContactView[] {
  const qterms = terms(query);
  if (qterms.length === 0) return [];
  return contacts
    .map((c) => {
      let score = 0;
      score += fieldScore(c.name, qterms, 4);
      score += fieldScore(c.email ?? '', qterms, 2);
      score += fieldScore(`${c.whatsapp ?? ''} ${c.telephone ?? ''}`, qterms, 1);
      return score > 0 ? { c, score } : null;
    })
    .filter((x): x is { c: ContactView; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.c);
}
