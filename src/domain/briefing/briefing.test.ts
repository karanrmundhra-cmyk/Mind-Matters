import { describe, it, expect } from 'vitest';
import { buildBriefing, weeklyClosedLoops } from '@/domain/briefing/briefing';
import type { Loop } from '@/domain/loop/types';

const IST = 'Asia/Kolkata';
const NOW = new Date('2026-06-28T10:00:00.000Z');

function makeLoop(over: Partial<Loop>): Loop {
  return {
    id: 'l', spaceId: 's', title: 'T', ask: 'a', definitionOfDone: 'd',
    deadline: null, priority: 'Medium', status: 'Awaiting', channel: 'email', source: 'manual',
    orderIndex: 0, followupPolicyDays: null, owners: [], createdById: 'u', createdAt: NOW,
    waitingSince: null, lastFollowupAt: null, nextFollowupAt: null, completedAt: null, closedAt: null, version: 0,
    ...over,
  };
}

describe('weeklyClosedLoops', () => {
  it('counts loops closed within the last 7 days', () => {
    const loops = [
      makeLoop({ status: 'Closed', closedAt: new Date('2026-06-25T10:00:00Z') }),
      makeLoop({ status: 'Completed', completedAt: new Date('2026-06-27T10:00:00Z') }),
      makeLoop({ status: 'Closed', closedAt: new Date('2026-06-10T10:00:00Z') }), // too old
      makeLoop({ status: 'Awaiting' }),
    ];
    expect(weeklyClosedLoops(loops, NOW)).toBe(2);
  });
});

describe('buildBriefing', () => {
  it('classifies overdue/due-today into needsYouToday and waiting into waitingOnOthers', () => {
    const loops = [
      makeLoop({ id: 'overdue', deadline: new Date('2026-06-26T18:00:00Z'), status: 'Awaiting' }),
      makeLoop({ id: 'today', deadline: new Date('2026-06-28T18:00:00Z'), status: 'Awaiting' }),
      makeLoop({ id: 'future', deadline: new Date('2026-07-05T18:00:00Z'), status: 'Awaiting' }),
    ];
    const b = buildBriefing(loops, NOW, IST);
    expect(b.needsYouToday.map((i) => i.loopId).sort()).toEqual(['overdue', 'today']);
    expect(b.waitingOnOthers.map((i) => i.loopId).sort()).toEqual(['future', 'overdue', 'today']);
  });

  it('suggests escalations for blocked, long-ignored, and critical-overdue loops', () => {
    const loops = [
      makeLoop({ id: 'blocked', status: 'Blocked' }),
      makeLoop({ id: 'ignored', status: 'Awaiting', waitingSince: new Date('2026-06-23T10:00:00Z') }), // 5d
      makeLoop({ id: 'crit', status: 'Awaiting', priority: 'Critical', deadline: new Date('2026-06-26T18:00:00Z') }),
      makeLoop({ id: 'fresh', status: 'Awaiting', waitingSince: NOW }),
    ];
    const ids = buildBriefing(loops, NOW, IST).suggestedEscalations.map((i) => i.loopId).sort();
    expect(ids).toEqual(['blocked', 'crit', 'ignored']);
  });

  it('ignores done loops', () => {
    const b = buildBriefing([makeLoop({ status: 'Closed', closedAt: NOW })], NOW, IST);
    expect(b.needsYouToday).toHaveLength(0);
    expect(b.waitingOnOthers).toHaveLength(0);
  });
});
