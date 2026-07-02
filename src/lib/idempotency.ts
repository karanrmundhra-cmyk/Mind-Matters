/**
 * Idempotency for state-changing operations. Every such POST accepts an Idempotency-Key;
 * the first time a (scope, key) pair is seen the operation runs and the result is recorded,
 * subsequent retries return the recorded result instead of re-running — so retries never
 * create duplicate loops, sends, or payments.
 */

const KEY_RE = /^[A-Za-z0-9_.:-]{8,200}$/;

export function isValidIdempotencyKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && KEY_RE.test(key);
}

export interface IdempotencyRecord<T = unknown> {
  result: T;
}

/** Persistence boundary for idempotency. In-memory for dev/tests; Prisma `IdempotencyKey` for prod. */
export interface IdempotencyStore {
  get<T>(scope: string, key: string): Promise<IdempotencyRecord<T> | null>;
  put<T>(scope: string, key: string, record: IdempotencyRecord<T>): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private map = new Map<string, IdempotencyRecord>();
  private k(scope: string, key: string) {
    return `${scope}::${key}`;
  }
  async get<T>(scope: string, key: string): Promise<IdempotencyRecord<T> | null> {
    return (this.map.get(this.k(scope, key)) as IdempotencyRecord<T> | undefined) ?? null;
  }
  async put<T>(scope: string, key: string, record: IdempotencyRecord<T>): Promise<void> {
    this.map.set(this.k(scope, key), record);
  }
}

/**
 * Run `fn` at most once per (scope, key). On a repeat key, returns the stored result
 * without re-running. An invalid key bypasses idempotency (runs normally) — callers
 * should reject missing keys at the API boundary where required.
 */
export async function runOnce<T>(
  store: IdempotencyStore,
  scope: string,
  key: string | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isValidIdempotencyKey(key)) return fn();
  const existing = await store.get<T>(scope, key);
  if (existing) return existing.result;
  const result = await fn();
  await store.put<T>(scope, key, { result });
  return result;
}
