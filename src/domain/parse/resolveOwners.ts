import type { KnownContact } from '@/domain/parse/fastPath';

export interface ResolvedOwners {
  ownerContactIds: string[];
  unresolvedOwners: string[];
}

/**
 * Map owner NAMES to known contacts. The single place the "never invent a contact"
 * rule is enforced: a name that doesn't match a known contact is returned as
 * unresolved (to be confirmed by the user), never fabricated into a contact.
 */
export function resolveOwnerNames(names: string[], contacts: KnownContact[]): ResolvedOwners {
  const ids = new Set<string>();
  const unresolved: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/^@/, '');
    if (!name) continue;
    const hit = contacts.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() ||
        c.name.toLowerCase().startsWith(name.toLowerCase()),
    );
    if (hit) ids.add(hit.id);
    else if (!unresolved.some((u) => u.toLowerCase() === name.toLowerCase())) unresolved.push(name);
  }
  return { ownerContactIds: [...ids], unresolvedOwners: unresolved };
}

/** Keep only owner ids that belong to known contacts (guards against invented ids). */
export function keepKnownOwnerIds(ids: string[], contacts: KnownContact[]): string[] {
  const known = new Set(contacts.map((c) => c.id));
  return ids.filter((id) => known.has(id));
}
