import { describe, it, expect } from 'vitest';
import {
  deriveReminders,
  bucketReminders,
  isWithinQuietHours,
  nextDeliverableTime,
  snoozeUntil,
  capPerLoopChannelDay,
  dueFollowups,
  type ReminderItem,
} from '@/domain/reminders/reminders';
import type { Loop } from '@/domain/loop/types';

const IST = 'Asia/Kolkata';
const NOW = new Date('2026-06-28T10:00:00.000Z'); // 15:30 IST, local day 2026-06-28

function makeLoop(over: Partial<Loop>): Loop {
  return {
    id: 'l1',
    spaceId: 's',
    title: 'Contract',
    ask: 'a',
    definitionOfDone: 'd',
    deadline: null,
    priority: 'High',
    status: 'Awaiting',
    channel: 'email',
    source: 'manual',
    orderIndex: 0,
    followupPolicyDays: null,
    owners: [],
    createdById: 'u',
    createdAt: NOW,
    waitingSince: NOW,
    lastFollowupAt: null,
    nextFollowupAt: null,
    completedAt: null,
    closedAt: null,
    version: 0,
    ...over,
  };
}

describe('deriveReminders', () => {
  it('emits a deadline and a follow-up reminder, and none for done loops', () => {
    const loops = [
      makeLoop({ id: 'a', deadline: new Date('2026-06-30T18:00:00Z'), nextFollowupAt: new Date('2026-06-29T10:00:00Z') }),
      makeLoop({ id: 'b', status: 'Closed', deadline: new Date('2026-06-30T18:00:00Z') }),
    ];
    const items = deriveReminders(loops);
    expect(items.filter((i) => i.loopId === 'a')).toHaveLength(2);
    expect(items.filter((i) => i.loopId === 'b')).toHaveLength(0);
  });
});

describe('bucketReminders (IST local days)', () => {
  it('splits overdue / today / upcoming', () => {
    const items: ReminderItem[] = [
      { loopId: 'a', loopTitle: 'A', kind: 'deadline', dueAt: new Date('2026-06-27T18:00:00Z'), channel: null },
      { loopId: 'b', loopTitle: 'B', kind: 'deadline', dueAt: new Date('2026-06-28T16:00:00Z'), channel: null },
      { loopId: 'c', loopTitle: 'C', kind: 'deadline', dueAt: new Date('2026-07-02T06:00:00Z'), channel: null },
    ];
    const b = bucketReminders(items, NOW, IST);
    expect(b.overdue.map((i) => i.loopId)).toEqual(['a']);
    expect(b.today.map((i) => i.loopId)).toEqual(['b']);
    expect(b.upcoming.map((i) => i.loopId)).toEqual(['c']);
  });
});

describe('quiet hours (overnight 22:00→07:00)', () => {
  const quiet = { startHour: 22, endHour: 7 };
  it('detects inside vs outside the window', () => {
    expect(isWithinQuietHours(new Date('2026-06-28T18:00:00Z'), IST, quiet)).toBe(true); // 23:30 IST
    expect(isWithinQuietHours(new Date('2026-06-28T03:00:00Z'), IST, quiet)).toBe(false); // 08:30 IST
  });

  it('holds a self-reminder until the window opens (07:00 next local day)', () => {
    expect(nextDeliverableTime(new Date('2026-06-28T18:00:00Z'), IST, quiet).toISOString()).toBe(
      '2026-06-29T01:30:00.000Z', // 07:00 IST on the 29th
    );
  });

  it('returns now when outside quiet hours', () => {
    const t = new Date('2026-06-28T03:00:00Z');
    expect(nextDeliverableTime(t, IST, quiet).getTime()).toBe(t.getTime());
  });
});

describe('snooze', () => {
  it('15m and 1h are exact offsets; tomorrow is 09:00 local next day', () => {
    expect(snoozeUntil(NOW, '15m', IST).toISOString()).toBe('2026-06-28T10:15:00.000Z');
    expect(snoozeUntil(NOW, '1h', IST).toISOString()).toBe('2026-06-28T11:00:00.000Z');
    expect(snoozeUntil(NOW, 'tomorrow', IST).toISOString()).toBe('2026-06-29T03:30:00.000Z'); // 09:00 IST 29th
  });
});

describe('dueFollowups (background job)', () => {
  it('selects loops whose follow-up is due and computes the reschedule time', () => {
    const loops = [
      makeLoop({ id: 'due', priority: 'High', nextFollowupAt: new Date('2026-06-28T09:00:00Z') }),
      makeLoop({ id: 'future', nextFollowupAt: new Date('2026-06-29T09:00:00Z') }),
      makeLoop({ id: 'closed', status: 'Closed', nextFollowupAt: new Date('2026-06-28T09:00:00Z') }),
    ];
    const due = dueFollowups(loops, NOW);
    expect(due.map((d) => d.loopId)).toEqual(['due']);
    // High = 2 days from now
    expect(due[0]!.rescheduleTo.toISOString()).toBe('2026-06-30T10:00:00.000Z');
  });

  it('is idempotent for the same inputs', () => {
    const loops = [makeLoop({ id: 'a', nextFollowupAt: new Date('2026-06-28T09:00:00Z') })];
    expect(dueFollowups(loops, NOW)).toEqual(dueFollowups(loops, NOW));
  });
});

describe('cap per loop+channel+day', () => {
  it('keeps one (earliest) reminder per loop/channel/local-day', () => {
    const items: ReminderItem[] = [
      { loopId: 'a', loopTitle: 'A', kind: 'followup', dueAt: new Date('2026-06-28T12:00:00Z'), channel: 'email' },
      { loopId: 'a', loopTitle: 'A', kind: 'followup', dueAt: new Date('2026-06-28T09:00:00Z'), channel: 'email' },
    ];
    const capped = capPerLoopChannelDay(items, IST);
    expect(capped).toHaveLength(1);
    expect(capped[0]!.dueAt.toISOString()).toBe('2026-06-28T09:00:00.000Z');
  });
});
