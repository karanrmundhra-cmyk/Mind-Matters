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

  // Apply a renumbered/optimistic update + POST and optional refetch.
  // `applyOrder(old)` must return the new ordered list of rows (NOT renumbered).
  const applyAndCommit = useCallback(
    (applyOrder) => {
      let posted = null;
      setRows((old) => {
        const copy = applyOrder(old);
        if (!copy || copy === old) return old;
        // Renumber sr_no in-place so visible Sr matches new positions immediately.
        const renumbered = copy.map((r, i) => ({ ...r, sr_no: i + 1 }));
        posted = renumbered.map((r) => r.id);
        return renumbered;
      });
      if (posted) {
        (async () => {
          try { await api.post(`/${resource}/reorder`, { ids: posted }); } catch { /* */ }
          if (typeof opts.onCommit === "function") {
            try { await opts.onCommit(); } catch { /* */ }
          }
        })();
      }
    },
    [resource, setRows, opts],
  );

  const move = useCallback(
    (id, dir) => {
      applyAndCommit((old) => {
        const idx = old.findIndex((r) => r.id === id);
        if (idx < 0) return null;
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= old.length) return null;
        const copy = old.slice();
        const [row] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, row);
        return copy;
      });
    },
    [applyAndCommit],
  );

  const onDragStart = (id) => () => setDraggingId(id);
  const onDragOver = () => (e) => e.preventDefault();
  const onDrop = (targetId) => (e) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    applyAndCommit((old) => {
      const from = old.findIndex((r) => r.id === draggingId);
      const to = old.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return null;
      const copy = old.slice();
      const [row] = copy.splice(from, 1);
      copy.splice(to, 0, row);
      return copy;
    });
  };
  const onDragEnd = () => setDraggingId(null);

  return { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId };
}
