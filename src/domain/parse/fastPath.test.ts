import { describe, it, expect } from 'vitest';
import { fastPathParse, type KnownContact } from '@/domain/parse/fastPath';
import { parseRelativeDate } from '@/domain/parse/dates';
import { parsedLoopSchema, PARSE_CONFIDENCE_THRESHOLD } from '@/domain/parse/schema';

const NOW = new Date('2026-06-28T10:00:00.000Z'); // a Sunday (UTC day 0)
const contacts: KnownContact[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Raj' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Mehta' },
];

describe('relative date parsing', () => {
  it('parses tomorrow / day after / in N days', () => {
    expect(parseRelativeDate('send it tomorrow', NOW)?.toISOString()).toBe(
      '2026-06-29T18:00:00.000Z',
    );
    expect(parseRelativeDate('day after tomorrow', NOW)?.toISOString()).toBe(
      '2026-06-30T18:00:00.000Z',
    );
    expect(parseRelativeDate('in 5 days', NOW)?.toISOString()).toBe('2026-07-03T18:00:00.000Z');
  });

  it('parses next weekday (by friday from a Sunday = +5)', () => {
    expect(parseRelativeDate('by friday', NOW)?.toISOString()).toBe('2026-07-03T18:00:00.000Z');
  });

  it('returns null when no date is expressed (never guesses)', () => {
    expect(parseRelativeDate('send the contract', NOW)).toBeNull();
  });
});

describe('fastPathParse', () => {
  it('produces schema-valid output', () => {
    const r = fastPathParse('@Raj send the signed contract by friday, urgent', contacts, NOW);
    expect(parsedLoopSchema.safeParse(r).success).toBe(true);
  });

  it('resolves a known @owner, deadline, and priority with high confidence', () => {
    const r = fastPathParse('@Raj send the signed contract tomorrow, urgent', contacts, NOW);
    expect(r.ownerContactIds).toEqual(['11111111-1111-1111-1111-111111111111']);
    expect(r.unresolvedOwners).toEqual([]);
    expect(r.priority).toBe('Critical');
    expect(r.deadlineIso).toBe('2026-06-29T18:00:00.000Z');
    expect(r.confidence).toBeGreaterThanOrEqual(PARSE_CONFIDENCE_THRESHOLD);
  });

  it('matches a bare known contact name without @', () => {
    const r = fastPathParse('Mehta must file the GST return', contacts, NOW);
    expect(r.ownerContactIds).toEqual(['22222222-2222-2222-2222-222222222222']);
  });

  it('never invents an unknown owner — keeps it unresolved and stays low-confidence', () => {
    const r = fastPathParse('@Vikram send me the quote', contacts, NOW);
    expect(r.ownerContactIds).toEqual([]);
    expect(r.unresolvedOwners).toEqual(['Vikram']);
    expect(r.confidence).toBeLessThan(PARSE_CONFIDENCE_THRESHOLD);
  });

  it('detects channel hints', () => {
    expect(fastPathParse('email @Raj the invoice', contacts, NOW).suggestedChannel).toBe('email');
    expect(fastPathParse('whatsapp @Raj the invoice', contacts, NOW).suggestedChannel).toBe(
      'whatsapp',
    );
    expect(fastPathParse('call @Raj about the invoice', contacts, NOW).suggestedChannel).toBe(
      'telephone',
    );
  });

  it('derives definition-of-done from an "until/once" clause', () => {
    const r = fastPathParse('@Raj chase the vendor until we get the quotation', contacts, NOW);
    expect(r.definitionOfDone.toLowerCase()).toContain('quotation');
  });
});
