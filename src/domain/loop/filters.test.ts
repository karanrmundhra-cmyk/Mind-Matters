import { describe, it, expect } from 'vitest';
import {
  selectLoops,
  applyFilters,
  deadlineBucket,
  daysWaiting,
  inSegment,
} from '@/domain/loop/filters';
import type { Loop } from '@/domain/loop/types';
import type { LoopStatus } from '@/domain/enums';

const NOW = new Date('2026-06-28T10:00:00.000Z');
const USER = 'user-1';

function makeLoop(over: Partial<Loop> = {}): Loop {
  return {
    id: Math.random().toString(36).slice(2),
    spaceId: 'space-1',
    title: 'T',
    ask: 'do it',
    definitionOfDone: 'done',
    deadline: null,
    priority: 'Medium',
    status: 'Awaiting',
    channel: 'email',
    source: 'manual',
    orderIndex: 0,
    followupPolicyDays: null,
    owners: [{ contactId: 'c1', name: 'Raj', subStatus: 'Awaiting', respondedAt: null }],
    createdById: USER,
    createdAt: NOW,
    waitingSince: null,
    lastFollowupAt: null,
    nextFollowupAt: null,
    completedAt: null,
    closedAt: null,
    version: 0,
    ...over,
  };
}

describe('deadline buckets', () => {
  it('classifies overdue / today / upcoming / none', () => {
    expect(deadlineBucket(makeLoop({ deadline: new Date('2026-06-27T10:00:00Z') }), NOW)).toBe('overdue');
    expect(deadlineBucket(makeLoop({ deadline: new Date('2026-06-28T20:00:00Z') }), NOW)).toBe('today');
    expect(deadlineBucket(makeLoop({ deadline: new Date('2026-07-05T10:00:00Z') }), NOW)).toBe('upcoming');
    expect(deadlineBucket(makeLoop({ deadline: null }), NOW)).toBe('none');
  });
});

describe('filters (AND semantics)', () => {
  const loops = [
    makeLoop({ id: 'a', priority: 'Critical', channel: 'email', status: 'Awaiting' }),
    makeLoop({ id: 'b', priority: 'Low', channel: 'whatsapp', status: 'Blocked' }),
    makeLoop({ id: 'c', priority: 'Critical', channel: 'whatsapp', status: 'Responded' }),
  ];

  it('combines priority + channel with AND', () => {
    const r = applyFilters(loops, { priorities: ['Critical'], channels: ['whatsapp'] }, NOW);
    expect(r.map((l) => l.id)).toEqual(['c']);
  });

  it('empty filter returns everything', () => {
    expect(applyFilters(loops, {}, NOW)).toHaveLength(3);
  });

  it('filters by status', () => {
    expect(applyFilters(loops, { statuses: ['Blocked'] }, NOW).map((l) => l.id)).toEqual(['b']);
  });
});

describe('segments + selectLoops', () => {
  it('waiting segment includes Scheduled/Awaiting/Blocked/Escalated only', () => {
    const statuses: LoopStatus[] = ['Awaiting', 'Blocked', 'Escalated', 'Scheduled', 'Responded', 'Closed'];
    const loops = statuses.map((s, i) => makeLoop({ id: s, status: s, orderIndex: i }));
    const r = selectLoops(loops, { segment: 'waiting', userId: USER, now: NOW });
    expect(r.map((l) => l.id).sort()).toEqual(['Awaiting', 'Blocked', 'Escalated', 'Scheduled']);
  });

  it('hides archived/deleted and sorts by orderIndex', () => {
    const loops = [
      makeLoop({ id: 'x', orderIndex: 2 }),
      makeLoop({ id: 'y', orderIndex: 0 }),
      makeLoop({ id: 'z', status: 'Archived', orderIndex: 1 }),
    ];
    const r = selectLoops(loops, { segment: 'by_me', userId: USER, now: NOW });
    expect(r.map((l) => l.id)).toEqual(['y', 'x']);
  });

  it('by_me matches creator; watching excludes creator/owner', () => {
    const mine = makeLoop({ createdById: USER });
    expect(inSegment(mine, 'by_me', USER)).toBe(true);
    expect(inSegment(mine, 'watching', USER)).toBe(false);
  });
});

describe('daysWaiting', () => {
  it('counts whole days since waitingSince', () => {
    expect(daysWaiting(makeLoop({ waitingSince: new Date('2026-06-24T10:00:00Z') }), NOW)).toBe(4);
    expect(daysWaiting(makeLoop({ waitingSince: null }), NOW)).toBe(0);
  });
});
