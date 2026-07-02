import type { ContactView } from '@/domain/loop/types';

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e === '' ? null : e;
}

/** Digits-only phone for comparison; keeps the last 10 digits to ignore country-code noise. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export interface ContactIdentity {
  email?: string | null;
  whatsapp?: string | null;
  telephone?: string | null;
}

/**
 * Find existing contacts that collide with the given identity on a normalized email or
 * phone number. Used to offer a merge instead of fragmenting a contact's history
 * ("Raj", "Rajesh", "Raj Office"). Pure.
 */
export function findDuplicates(candidate: ContactIdentity, existing: ContactView[]): ContactView[] {
  const email = normalizeEmail(candidate.email);
  const phones = new Set(
    [normalizePhone(candidate.whatsapp), normalizePhone(candidate.telephone)].filter(
      (p): p is string => p !== null,
    ),
  );
  return existing.filter((c) => {
    if (email && normalizeEmail(c.email) === email) return true;
    const cPhones = [normalizePhone(c.whatsapp), normalizePhone(c.telephone)].filter(Boolean);
    return cPhones.some((p) => p && phones.has(p));
  });
}

export function isDuplicate(candidate: ContactIdentity, existing: ContactView[]): boolean {
  return findDuplicates(candidate, existing).length > 0;
}

/**
 * Choose the canonical contact among a duplicate set: the one with the most channels on
 * file (richest record), tie-broken by id for determinism.
 */
export function chooseCanonical(contacts: ContactView[]): ContactView | null {
  if (contacts.length === 0) return null;
  const channelCount = (c: ContactView) =>
    [c.email, c.whatsapp, c.telephone].filter(Boolean).length;
  return [...contacts].sort((a, b) => channelCount(b) - channelCount(a) || a.id.localeCompare(b.id))[0]!;
}
