import { describe, it, expect } from 'vitest';
import { parseLoop } from '@/domain/parse/orchestrator';
import type { KnownContact } from '@/domain/parse/fastPath';
import type { ModelProvider, AIParseOutput, AIParseInput, AIDraftInput } from '@/ai/types';
import { StubProvider } from '@/ai/providers/stub';

const NOW = new Date('2026-06-28T10:00:00.000Z');
const RAJ = '11111111-1111-1111-1111-111111111111';
const contacts: KnownContact[] = [{ id: RAJ, name: 'Raj' }];

/** A provider that records whether it was called, returning a canned output. */
class SpyProvider implements ModelProvider {
  readonly name = 'spy';
  calls = 0;
  constructor(private readonly out: AIParseOutput) {}
  async parseLoop(_input: AIParseInput): Promise<AIParseOutput> {
    this.calls++;
    return this.out;
  }
  async draftMessage(_input: AIDraftInput): Promise<string> {
    return 'draft';
  }
}

const canned = (over: Partial<AIParseOutput> = {}): AIParseOutput => ({
  owners: ['Raj'],
  title: 'Send contract',
  ask: 'Send the signed contract',
  definitionOfDone: 'Signed PDF received',
  deadlineIso: '2026-07-01T18:00:00.000Z',
  priority: 'High',
  suggestedChannel: 'email',
  confidence: 0.9,
  clarifyingQuestion: null,
  ...over,
});

describe('parseLoop orchestrator', () => {
  it('takes the fast-path WITHOUT calling the model when confident + owner resolved', async () => {
    const spy = new SpyProvider(canned());
    const r = await parseLoop('@Raj send the signed contract tomorrow, urgent', contacts, {
      provider: spy,
      now: NOW,
    });
    expect(r.kind).toBe('draft');
    expect(spy.calls).toBe(0);
  });

  it('falls back to the model and returns a draft when the model resolves the gap', async () => {
    const spy = new SpyProvider(canned());
    // No owner token the fast-path can catch → triggers the model.
    const r = await parseLoop('need the signed contract sent over', contacts, {
      provider: spy,
      now: NOW,
    });
    expect(spy.calls).toBe(1);
    expect(r.kind).toBe('draft');
    if (r.kind === 'draft') expect(r.loop.ownerContactIds).toEqual([RAJ]);
  });

  it('asks one question when no owner can be resolved (never invents)', async () => {
    const spy = new SpyProvider(canned({ owners: ['Vikram'], confidence: 0.9 }));
    const r = await parseLoop('ask Vikram for the quote', contacts, { provider: spy, now: NOW });
    expect(r.kind).toBe('question');
    if (r.kind === 'question') {
      expect(r.partial.ownerContactIds).toEqual([]);
      expect(r.partial.unresolvedOwners).toContain('Vikram');
    }
  });

  it('respects an explicit clarifying question from the model', async () => {
    const spy = new SpyProvider(canned({ clarifyingQuestion: 'What exactly counts as done?' }));
    // No fast-path-resolvable owner ⇒ the model is consulted and its question is honoured.
    const r = await parseLoop('someone needs to handle the thing', contacts, {
      provider: spy,
      now: NOW,
    });
    expect(spy.calls).toBe(1);
    expect(r.kind).toBe('question');
    if (r.kind === 'question') expect(r.question).toBe('What exactly counts as done?');
  });

  it('asks to correct a past deadline', async () => {
    const spy = new SpyProvider(canned({ deadlineIso: '2026-06-01T18:00:00.000Z' }));
    // No fast-path-resolvable owner ⇒ model branch ⇒ its past deadline is caught.
    const r = await parseLoop('send the contract over please', contacts, { provider: spy, now: NOW });
    expect(spy.calls).toBe(1);
    expect(r.kind).toBe('question');
    if (r.kind === 'question') expect(r.question.toLowerCase()).toContain('deadline');
  });

  it('works with the keyless StubProvider as graceful fallback', async () => {
    const r = await parseLoop('@Raj send the signed contract tomorrow', contacts, {
      provider: new StubProvider(),
      now: NOW,
    });
    expect(['draft', 'question']).toContain(r.kind);
  });
});
