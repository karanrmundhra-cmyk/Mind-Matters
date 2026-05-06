import { useState, useCallback } from "react";
import { api } from "@/lib/api";

/**
 * useReorder — state + callbacks for inline up/down arrows + HTML5 drag-and-drop.
 * Calls POST /api/<resource>/reorder with the new ordered list of ids.
 *
 * Usage:
 *   const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
 *     useReorder("tasks", rows, setRows);
 *
 *   <tr draggable onDragStart={onDragStart(t.id)} onDragOver={onDragOver(t.id)}
 *                onDrop={onDrop(t.id)} onDragEnd={onDragEnd}>
 *     <ArrowUp onClick={() => move(t.id, -1)}/>
 */
export function useReorder(resource, rows, setRows, opts = {}) {
  const [draggingId, setDraggingId] = useState(null);

  const commit = useCallback(
    async (ordered) => {
      // Optimistically update sr_no on rows so the visible Sr column reflects new order.
      setRows((current) => {
        const rank = new Map(ordered.map((r, i) => [r.id, i + 1]));
        return current.map((r) => (rank.has(r.id) ? { ...r, sr_no: rank.get(r.id) } : r));
      });
      try {
        await api.post(`/${resource}/reorder`, { ids: ordered.map((r) => r.id) });
      } catch {
        // swallow — state already updated optimistically; user can refresh
      }
    },
    [resource, setRows],
  );

  const move = useCallback(
    (id, dir) => {
      setRows((old) => {
        const idx = old.findIndex((r) => r.id === id);
        if (idx < 0) return old;
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= old.length) return old;
        const copy = old.slice();
        const [row] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, row);
        commit(copy);
        return copy;
      });
    },
    [setRows, commit],
  );

  const onDragStart = (id) => () => setDraggingId(id);
  const onDragOver = () => (e) => e.preventDefault();
  const onDrop = (targetId) => (e) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    setRows((old) => {
      const from = old.findIndex((r) => r.id === draggingId);
      const to = old.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return old;
      const copy = old.slice();
      const [row] = copy.splice(from, 1);
      copy.splice(to, 0, row);
      commit(copy);
      return copy;
    });
  };
  const onDragEnd = () => setDraggingId(null);

  return { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId };
}
