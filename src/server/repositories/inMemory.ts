import type {
  WorkspaceRepository,
  NewLoopInput,
  LoopPatch,
  NewTouchInput,
} from '@/domain/loop/repository';
import type { Loop, TouchView, ContactView, GroupView } from '@/domain/loop/types';
import type { LoopStatus } from '@/domain/enums';
import type { TransitionOptions } from '@/domain/loop/service';
import { planTransition } from '@/domain/loop/service';
import { LoopNotFoundError, OptimisticLockError } from '@/domain/errors';

const uuid = () => globalThis.crypto.randomUUID();

/**
 * In-memory WorkspaceRepository — TEMPORARY dev/test scaffolding to unblock UI and
 * logic without a database. The Prisma/Supabase repository will implement the same
 * WorkspaceRepository interface and replace this with no changes elsewhere.
 * NOTE: state is per-process and resets on restart — never used in production.
 */
export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private loops = new Map<string, Loop>();
  private touches = new Map<string, TouchView[]>();
  private contacts = new Map<string, ContactView>();
  private groups = new Map<string, GroupView>();

  constructor(private readonly spaceId: string, private readonly userId: string) {
    this.seed();
  }

  private async assertLoop(spaceId: string, id: string): Promise<Loop> {
    const loop = this.loops.get(id);
    if (!loop || loop.spaceId !== spaceId) throw new LoopNotFoundError(id);
    return loop;
  }

  async listLoops(spaceId: string): Promise<Loop[]> {
    return [...this.loops.values()].filter((l) => l.spaceId === spaceId).map((l) => ({ ...l }));
  }

  async getLoop(spaceId: string, id: string): Promise<Loop | null> {
    const loop = this.loops.get(id);
    return loop && loop.spaceId === spaceId ? { ...loop } : null;
  }

  async createLoop(input: NewLoopInput): Promise<Loop> {
    const id = uuid();
    const now = new Date();
    const maxOrder = Math.max(-1, ...[...this.loops.values()].map((l) => l.orderIndex));
    const status = input.status ?? 'Confirmed';
    const loop: Loop = {
      id,
      spaceId: input.spaceId,
      title: input.title,
      ask: input.ask,
      definitionOfDone: input.definitionOfDone,
      deadline: input.deadline,
      priority: input.priority,
      status,
      channel: input.channel,
      source: input.source,
      orderIndex: maxOrder + 1,
      followupPolicyDays: input.followupPolicyDays ?? null,
      owners: input.owners.map((o) => ({
        contactId: o.contactId,
        name: o.name,
        subStatus: 'Awaiting',
        respondedAt: null,
      })),
      createdById: input.createdById,
      createdAt: now,
      waitingSince: null,
      lastFollowupAt: null,
      nextFollowupAt: null,
      completedAt: null,
      closedAt: null,
      version: 0,
    };
    this.loops.set(id, loop);
    this.touches.set(id, [
      { id: uuid(), loopId: id, type: 'created', channel: null, timestamp: now, payload: null },
    ]);
    return { ...loop };
  }

  async updateLoop(
    spaceId: string,
    id: string,
    patch: LoopPatch,
    expectedVersion: number,
  ): Promise<Loop> {
    const loop = await this.assertLoop(spaceId, id);
    if (loop.version !== expectedVersion) throw new OptimisticLockError(id);
    Object.assign(loop, patch);
    loop.version += 1;
    return { ...loop };
  }

  async reorderLoops(spaceId: string, orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const loop = this.loops.get(id);
      if (loop && loop.spaceId === spaceId) loop.orderIndex = index;
    });
  }

  async applyTransition(
    spaceId: string,
    id: string,
    to: LoopStatus,
    opts: TransitionOptions = {},
  ): Promise<Loop> {
    const loop = await this.assertLoop(spaceId, id);
    const plan = planTransition(loop, to, opts); // shared business logic
    Object.assign(loop, plan.updates);
    loop.version += 1;
    const list = this.touches.get(id) ?? [];
    list.push({
      id: uuid(),
      loopId: id,
      type: plan.touch.type,
      channel: null,
      timestamp: opts.now ?? new Date(),
      payload: plan.touch.payload,
    });
    this.touches.set(id, list);
    return { ...loop };
  }

  async listTouches(loopId: string): Promise<TouchView[]> {
    return [...(this.touches.get(loopId) ?? [])].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  async addTouch(loopId: string, touch: NewTouchInput): Promise<TouchView> {
    const t: TouchView = {
      id: uuid(),
      loopId,
      type: touch.type,
      channel: touch.channel ?? null,
      timestamp: new Date(),
      payload: touch.payload ?? null,
    };
    const list = this.touches.get(loopId) ?? [];
    list.push(t);
    this.touches.set(loopId, list);
    return t;
  }

  async listContacts(spaceId: string): Promise<ContactView[]> {
    void spaceId;
    return [...this.contacts.values()];
  }

  async listGroups(spaceId: string): Promise<GroupView[]> {
    void spaceId;
    return [...this.groups.values()];
  }

  // ---- seed (dev only) ----
  private seed() {
    const group: GroupView = { id: uuid(), name: 'Clients' };
    this.groups.set(group.id, group);

    const raj: ContactView = {
      id: uuid(),
      name: 'Raj',
      email: 'raj@example.com',
      whatsapp: '+919900000001',
      telephone: null,
      groupId: group.id,
    };
    const ca: ContactView = {
      id: uuid(),
      name: 'CA (Mehta & Co)',
      email: 'mehta@example.com',
      whatsapp: null,
      telephone: null,
      groupId: null,
    };
    this.contacts.set(raj.id, raj);
    this.contacts.set(ca.id, ca);

    const now = new Date();
    const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

    const seedLoops: Array<Partial<Loop> & { title: string; ask: string; definitionOfDone: string }> = [
      {
        title: 'Signed contract from Raj',
        ask: 'Send the signed services contract',
        definitionOfDone: 'Signed PDF received',
        deadline: inDays(3),
        priority: 'High',
        status: 'Awaiting',
        channel: 'email',
        waitingSince: now,
        nextFollowupAt: inDays(2),
        owners: [{ contactId: raj.id, name: raj.name, subStatus: 'Awaiting', respondedAt: null }],
        orderIndex: 0,
      },
      {
        title: 'GST filing',
        ask: 'File this month’s GST return',
        definitionOfDone: 'Filing acknowledgement number received',
        deadline: inDays(-1),
        priority: 'Critical',
        status: 'Awaiting',
        channel: 'whatsapp',
        waitingSince: inDays(-4),
        nextFollowupAt: inDays(-1),
        owners: [{ contactId: ca.id, name: ca.name, subStatus: 'Awaiting', respondedAt: null }],
        orderIndex: 1,
      },
      {
        title: 'Quotation from vendor',
        ask: 'Send quotation for the new order',
        definitionOfDone: 'Quotation received and approved',
        priority: 'Medium',
        status: 'Closed',
        channel: 'email',
        completedAt: inDays(-2),
        closedAt: inDays(-1),
        owners: [{ contactId: raj.id, name: raj.name, subStatus: 'Responded', respondedAt: inDays(-2) }],
        orderIndex: 2,
      },
    ];

    for (const s of seedLoops) {
      const id = uuid();
      const loop: Loop = {
        id,
        spaceId: this.spaceId,
        title: s.title,
        ask: s.ask,
        definitionOfDone: s.definitionOfDone,
        deadline: s.deadline ?? null,
        priority: s.priority ?? 'Medium',
        status: s.status ?? 'Confirmed',
        channel: s.channel ?? null,
        source: 'manual',
        orderIndex: s.orderIndex ?? 0,
        followupPolicyDays: null,
        owners: s.owners ?? [],
        createdById: this.userId,
        createdAt: now,
        waitingSince: s.waitingSince ?? null,
        lastFollowupAt: null,
        nextFollowupAt: s.nextFollowupAt ?? null,
        completedAt: s.completedAt ?? null,
        closedAt: s.closedAt ?? null,
        version: 0,
      };
      this.loops.set(id, loop);
      this.touches.set(id, [
        { id: uuid(), loopId: id, type: 'created', channel: null, timestamp: now, payload: null },
      ]);
    }
  }
}
