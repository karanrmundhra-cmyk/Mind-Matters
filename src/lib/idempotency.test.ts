import { describe, it, expect } from 'vitest';
import {
  isValidIdempotencyKey,
  InMemoryIdempotencyStore,
  runOnce,
} from '@/lib/idempotency';

describe('idempotency key validation', () => {
  it('accepts reasonable keys, rejects junk', () => {
    expect(isValidIdempotencyKey('a1b2c3d4-e5f6')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey('has spaces!!')).toBe(false);
  });
});

describe('runOnce', () => {
  it('runs fn once per (scope,key) and returns the cached result on retry', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const op = () => {
      calls++;
      return Promise.resolve({ id: calls });
    };
    const a = await runOnce(store, 'loops.create', 'key-12345678', op);
    const b = await runOnce(store, 'loops.create', 'key-12345678', op);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(a.id).toBe(1);
  });

  it('different keys run independently', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const op = () => Promise.resolve(++calls);
    await runOnce(store, 'send', 'key-aaaaaaaa', op);
    await runOnce(store, 'send', 'key-bbbbbbbb', op);
    expect(calls).toBe(2);
  });

  it('invalid/missing key bypasses dedupe (runs every time)', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const op = () => Promise.resolve(++calls);
    await runOnce(store, 'send', null, op);
    await runOnce(store, 'send', null, op);
    expect(calls).toBe(2);
  });
});
