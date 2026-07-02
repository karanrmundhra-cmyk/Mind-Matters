import { describe, it, expect } from 'vitest';
import { searchLoops, searchContacts } from '@/domain/search/search';
import type { Loop, ContactView } from '@/domain/loop/types';

const NOW = new Date('2026-06-28T10:00:00.000Z');

function makeLoop(over: Partial<Loop>): Loop {
  return {
    id: Math.random().toString(36).slice(2),
    spaceId: 's', title: 'T', ask: 'a', definitionOfDone: 'd',
    deadline: null, priority: 'Medium', status: 'Awaiting', channel: 'email', source: 'manual',
    orderIndex: 0, followupPolicyDays: null,
    owners: [{ contactId: 'c1', name: 'Raj', subStatus: 'Awaiting', respondedAt: null }],
    createdById: 'u', createdAt: NOW, waitingSince: null, lastFollowupAt: null,
    nextFollowupAt: null, completedAt: null, closedAt: null, version: 0,
    ...over,
  };
}

describe('searchLoops', () => {
  const loops = [
    makeLoop({ id: 'contract', title: 'Signed contract from Raj', ask: 'send the signed contract' }),
    makeLoop({ id: 'gst', title: 'GST filing', ask: 'file the GST return', owners: [{ contactId: 'c2', name: 'Mehta', subStatus: 'Awaiting', respondedAt: null }] }),
    makeLoop({ id: 'quote', title: 'Quotation from vendor', ask: 'send quotation' }),
  ];

  it('ranks title matches highest', () => {
    const r = searchLoops(loops, 'contract', NOW);
    expect(r[0]?.id).toBe('contract');
  });

  it('matches by owner name', () => {
    const r = searchLoops(loops, 'mehta', NOW);
    expect(r.map((l) => l.id)).toContain('gst');
  });

  it('returns empty for an empty query and for no matches', () => {
    expect(searchLoops(loops, '', NOW)).toEqual([]);
    expect(searchLoops(loops, 'zzzz', NOW)).toEqual([]);
  });

  it('demotes closed loops below open ones with equal text match', () => {
    const open = makeLoop({ id: 'open', title: 'invoice reminder', status: 'Awaiting' });
    const closed = makeLoop({ id: 'closed', title: 'invoice reminder', status: 'Closed' });
    const r = searchLoops([closed, open], 'invoice', NOW);
    expect(r[0]?.id).toBe('open');
  });
});

describe('searchContacts', () => {
  const contacts: ContactView[] = [
    { id: 'raj', name: 'Raj', email: 'raj@example.com', whatsapp: '+9199', telephone: null, groupId: null },
    { id: 'mehta', name: 'Mehta & Co', email: 'mehta@example.com', whatsapp: null, telephone: null, groupId: null },
  ];

  it('finds by name and email', () => {
    expect(searchContacts(contacts, 'raj').map((c) => c.id)).toEqual(['raj']);
    expect(searchContacts(contacts, 'mehta@example').map((c) => c.id)).toEqual(['mehta']);
  });
});
