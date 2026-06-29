'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Inbox, X, GripVertical } from 'lucide-react';
import { LoopRow } from '@/components/loops/LoopRow';
import { Chip } from '@/components/ui/Chip';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/cn';
import { selectLoops, type Segment, type LoopFilter, type DeadlineBucket } from '@/domain/loop/filters';
import { PRIORITIES, type Priority } from '@/domain/enums';
import type { Loop, ContactView, GroupView } from '@/domain/loop/types';
import { closeLoopAction, reorderLoopsAction } from '@/app/loops/actions';

const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: 'by_me', label: 'By me' },
  { id: 'to_me', label: 'To me' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'watching', label: 'Watching' },
];

const DEADLINES: Array<{ id: DeadlineBucket; label: string }> = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
];

export function LoopsClient({
  loops,
  contacts,
  groups,
  userId,
}: {
  loops: Loop[];
  contacts: ContactView[];
  groups: GroupView[];
  userId: string;
}) {
  const [segment, setSegment] = useState<Segment>('by_me');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [deadline, setDeadline] = useState<DeadlineBucket | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Local working order so drag/keyboard reorder reflects instantly; re-synced when
  // the server sends fresh data (e.g. after a revalidate).
  const [localLoops, setLocalLoops] = useState<Loop[]>(loops);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  useEffect(() => setLocalLoops(loops), [loops]);

  const groupContactIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of groups) map.set(g.id, contacts.filter((c) => c.groupId === g.id).map((c) => c.id));
    return map;
  }, [groups, contacts]);

  const filter: LoopFilter = useMemo(() => {
    const f: LoopFilter = {};
    if (priority) f.priorities = [priority];
    if (deadline) f.deadline = deadline;
    if (groupId) f.ownerContactIds = groupContactIds.get(groupId) ?? [];
    return f;
  }, [priority, deadline, groupId, groupContactIds]);

  const visible = useMemo(
    () => selectLoops(localLoops, { segment, userId, filter }).filter((l) => !closing.has(l.id)),
    [localLoops, segment, userId, filter, closing],
  );

  const hasFilters = priority !== null || deadline !== null || groupId !== null;
  // Manual reordering only makes sense for the unfiltered "By me" list.
  const reorderable = !hasFilters && segment === 'by_me';

  function clearFilters() {
    setPriority(null);
    setDeadline(null);
    setGroupId(null);
  }

  function handleClose(id: string) {
    setClosing((prev) => new Set(prev).add(id));
    startTransition(() => {
      void closeLoopAction(id);
    });
  }

  /** Persist a reorder of the visible list: move item at `from` to `to`. */
  function move(from: number, to: number) {
    if (to < 0 || to >= visible.length || from === to) return;
    const ids = visible.map((l) => l.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    // Optimistically apply the new order to local state.
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    setLocalLoops((prev) =>
      prev.map((l) => (orderMap.has(l.id) ? { ...l, orderIndex: orderMap.get(l.id)! } : l)),
    );
    startTransition(() => {
      void reorderLoopsAction(ids);
    });
  }

  return (
    <div>
      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Loop segments">
        {SEGMENTS.map((s) => (
          <Chip key={s.id} active={segment === s.id} onClick={() => setSegment(s.id)} role="tab" aria-selected={segment === s.id}>
            {s.label}
          </Chip>
        ))}
      </div>

      {groups.length > 0 && (
        <div className="-mx-5 mb-2 flex gap-2 overflow-x-auto px-5 pb-1">
          {groups.map((g) => (
            <Chip key={g.id} active={groupId === g.id} onClick={() => setGroupId(groupId === g.id ? null : g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="-mx-5 mb-4 flex items-center gap-2 overflow-x-auto px-5 pb-1">
        {PRIORITIES.map((p) => (
          <Chip key={p} active={priority === p} onClick={() => setPriority(priority === p ? null : p)}>
            {p}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
        {DEADLINES.map((d) => (
          <Chip key={d.id} active={deadline === d.id} onClick={() => setDeadline(deadline === d.id ? null : d.id)}>
            {d.label}
          </Chip>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="pos-focus ml-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-pill px-3 text-sm text-muted hover:text-text"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <GlassCard className="mt-2 flex flex-col items-center gap-2 py-10 text-center">
          <Inbox className="h-6 w-6 text-faint" aria-hidden />
          <p className="text-sm text-muted">
            {hasFilters ? 'No loops match these filters.' : 'No loops here yet — capture one below.'}
          </p>
        </GlassCard>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((loop, i) => (
            <li
              key={loop.id}
              className={cn('flex items-center gap-1.5', dragIndex === i && 'opacity-60')}
              draggable={reorderable}
              onDragStart={reorderable ? () => setDragIndex(i) : undefined}
              onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
              onDrop={
                reorderable
                  ? (e) => {
                      e.preventDefault();
                      if (dragIndex !== null) move(dragIndex, i);
                      setDragIndex(null);
                    }
                  : undefined
              }
            >
              {reorderable && (
                <button
                  type="button"
                  aria-label={`Reorder ${loop.title}. Use up and down arrow keys to move.`}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      move(i, i - 1);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      move(i, i + 1);
                    }
                  }}
                  className="pos-focus flex h-11 w-6 shrink-0 cursor-grab items-center justify-center text-faint hover:text-muted active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <LoopRow loop={loop} onClose={handleClose} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
