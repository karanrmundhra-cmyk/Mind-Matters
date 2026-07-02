import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone, findDuplicates, chooseCanonical } from '@/domain/contacts/dedup';
import type { ContactView } from '@/domain/loop/types';

const c = (over: Partial<ContactView>): ContactView => ({
  id: 'x', name: 'X', email: null, whatsapp: null, telephone: null, groupId: null, ...over,
});

describe('normalization', () => {
  it('normalizes email + phone', () => {
    expect(normalizeEmail('  Raj@Example.com ')).toBe('raj@example.com');
    expect(normalizePhone('+91 (990) 000-0001')).toBe('9900000001');
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('findDuplicates', () => {
  const existing = [
    c({ id: 'raj', name: 'Raj', email: 'raj@example.com', whatsapp: '+919900000001' }),
    c({ id: 'mehta', name: 'Mehta', email: 'mehta@example.com' }),
  ];

  it('matches on email (case-insensitive)', () => {
    expect(findDuplicates({ email: 'RAJ@example.com' }, existing).map((x) => x.id)).toEqual(['raj']);
  });

  it('matches on phone regardless of formatting', () => {
    expect(findDuplicates({ whatsapp: '9900000001' }, existing).map((x) => x.id)).toEqual(['raj']);
  });

  it('no false positives', () => {
    expect(findDuplicates({ email: 'new@example.com', telephone: '+1 555 0000' }, existing)).toEqual([]);
  });
});

describe('chooseCanonical', () => {
  it('prefers the richest record', () => {
    const dupes = [
      c({ id: 'a', email: 'r@x.com' }),
      c({ id: 'b', email: 'r@x.com', whatsapp: '+91', telephone: '+91' }),
    ];
    expect(chooseCanonical(dupes)?.id).toBe('b');
  });
});
