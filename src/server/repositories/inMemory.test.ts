import { describe, it, expect } from 'vitest';
import { InMemoryWorkspaceRepository } from '@/server/repositories/inMemory';
import { OptimisticLockError } from '@/domain/errors';

const SPACE = 'space-x';
const USER = 'user-x';

describe('InMemoryWorkspaceRepository', () => {
  it('seeds loops, contacts and groups', async () => {
    const repo = new InMemoryWorkspaceRepository(SPACE, USER);
    expect((await repo.listLoops(SPACE)).length).toBeGreaterThanOrEqual(3);
    expect((await repo.listContacts(SPACE)).length).toBeGreaterThanOrEqual(2);
    expect((await repo.listGroups(SPACE)).length).toBeGreaterThanOrEqual(1);
  });

  it('creates a loop and records a created touch', async () => {
    const repo = new InMemoryWorkspaceRepository(SPACE, USER);
    const loop = await repo.createLoop({
      spaceId: SPACE,
      createdById: USER,
      title: 'New',
      ask: 'do thing',
      definitionOfDone: 'thing done',
      deadline: null,
      priority: 'High',
      channel: 'email',
      source: 'manual',
      owners: [{ contactId: 'c1', name: 'Raj' }],
    });
    expect(loop.status).toBe('Confirmed');
    const touches = await repo.listTouches(loop.id);
    expect(touches[0]?.type).toBe('created');
  });

  it('applies a transition via shared planTransition, bumping version + timeline', async () => {
    const repo = new InMemoryWorkspaceRepository(SPACE, USER);
    const loop = await repo.createLoop({
      spaceId: SPACE,
      createdById: USER,
      title: 'New',
      ask: 'do thing',
      definitionOfDone: 'thing done',
      deadline: null,
      priority: 'High',
      channel: 'email',
      source: 'manual',
      owners: [{ contactId: 'c1', name: 'Raj' }],
    });
    await repo.applyTransition(SPACE, loop.id, 'Scheduled');
    const awaiting = await repo.applyTransition(SPACE, loop.id, 'Awaiting');
    expect(awaiting.status).toBe('Awaiting');
    expect(awaiting.waitingSince).not.toBeNull();
    expect(awaiting.nextFollowupAt).not.toBeNull();
    expect(awaiting.version).toBe(2);
  });

  it('enforces optimistic locking on update', async () => {
    const repo = new InMemoryWorkspaceRepository(SPACE, USER);
    const [loop] = await repo.listLoops(SPACE);
    await expect(repo.updateLoop(SPACE, loop!.id, { title: 'x' }, 999)).rejects.toBeInstanceOf(
      OptimisticLockError,
    );
  });

  it('persists reorder', async () => {
    const repo = new InMemoryWorkspaceRepository(SPACE, USER);
    const loops = await repo.listLoops(SPACE);
    const reversed = [...loops].reverse().map((l) => l.id);
    await repo.reorderLoops(SPACE, reversed);
    const after = (await repo.listLoops(SPACE)).sort((a, b) => a.orderIndex - b.orderIndex);
    expect(after.map((l) => l.id)).toEqual(reversed);
  });
});
