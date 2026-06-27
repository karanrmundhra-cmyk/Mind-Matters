/** Domain errors shared across every persistence implementation. */

export class LoopNotFoundError extends Error {
  constructor(loopId: string) {
    super(`Loop ${loopId} not found.`);
    this.name = 'LoopNotFoundError';
  }
}

export class OptimisticLockError extends Error {
  constructor(entityId: string) {
    super(`${entityId} was modified concurrently; please retry.`);
    this.name = 'OptimisticLockError';
  }
}
