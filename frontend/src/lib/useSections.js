import { useCallback, useEffect, useState } from "react";
import {
  listSections,
  createSection as apiCreate,
  renameSection as apiRename,
  deleteSection as apiDelete,
  reorderSections as apiReorder,
  isCollapsed as readCollapsed,
  setCollapsed as writeCollapsed,
} from "@/lib/sections";
import { toast } from "sonner";

/**
 * useSections — small hook that owns the section list for one (project, module)
 * tuple and exposes mutators + collapse-state helpers.
 *
 * Returns:
 *   sections      — array of section docs (in render order)
 *   load          — () => Promise; refresh from server
 *   create        — (name) => Promise<section>
 *   rename        — (id, name) => Promise
 *   remove        — (id) => Promise<count> — count of rows that lost their section
 *   move          — (id, delta) => Promise — ±1 reorder
 *   isCollapsed   — (sectionKey) => boolean   — sectionKey can be section id or "none"
 *   toggleCollapsed — (sectionKey) => void
 *   enabled       — true when projectId is set
 */
export function useSections(projectId, module) {
  const [sections, setSections] = useState([]);
  const [collapsedTick, setCollapsedTick] = useState(0);

  const load = useCallback(async () => {
    if (!projectId) {
      setSections([]);
      return;
    }
    try {
      const list = await listSections(projectId, module);
      setSections(list);
    } catch {
      /* silent — backend may not have a project yet */
    }
  }, [projectId, module]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (name) => {
    if (!projectId) {
      toast.error("Pick a project first to add sections");
      return null;
    }
    try {
      const doc = await apiCreate(projectId, module, name);
      await load();
      toast.success(`Section "${doc.name}" added`);
      return doc;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not add section");
      return null;
    }
  }, [projectId, module, load]);

  const rename = useCallback(async (id, name) => {
    try {
      await apiRename(id, name);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not rename");
    }
  }, [load]);

  const remove = useCallback(async (id) => {
    try {
      await apiDelete(id);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete");
    }
  }, [load]);

  const move = useCallback(async (id, delta) => {
    if (!projectId) return;
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setSections(next); // optimistic
    try {
      await apiReorder(projectId, module, next.map((s) => s.id));
    } catch (e) {
      toast.error("Could not reorder — reloading");
      await load();
    }
  }, [sections, projectId, module, load]);

  const isCollapsed = useCallback(
    (sectionKey) => {
      // eslint-disable-next-line no-unused-vars
      const _ = collapsedTick; // re-evaluate on toggle
      return readCollapsed(projectId, module, sectionKey);
    },
    [projectId, module, collapsedTick],
  );

  const toggleCollapsed = useCallback((sectionKey) => {
    const cur = readCollapsed(projectId, module, sectionKey);
    writeCollapsed(projectId, module, sectionKey, !cur);
    setCollapsedTick((t) => t + 1);
  }, [projectId, module]);

  return {
    sections,
    load,
    create,
    rename,
    remove,
    move,
    isCollapsed,
    toggleCollapsed,
    enabled: !!projectId,
  };
}
