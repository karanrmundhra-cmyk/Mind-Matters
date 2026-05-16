// Sections API helpers — used by Tasks / Routines / CashFlow to load, create,
// rename, reorder and delete project-scoped section dividers.
//
// All section operations are project-scoped on the backend. When no project
// is selected (legacy single-project mode pre-v2.17), sections are simply
// disabled — the page falls back to a flat list.

import { api } from "@/lib/api";

export async function listSections(projectId, module) {
  if (!projectId) return [];
  const { data } = await api.get(
    `/projects/${projectId}/sections?module=${module}`,
  );
  return data || [];
}

export async function createSection(projectId, module, name) {
  const { data } = await api.post(`/projects/${projectId}/sections`, {
    module,
    name,
  });
  return data;
}

export async function renameSection(sectionId, name) {
  const { data } = await api.patch(`/sections/${sectionId}`, { name });
  return data;
}

export async function deleteSection(sectionId) {
  const { data } = await api.delete(`/sections/${sectionId}`);
  return data;
}

export async function reorderSections(projectId, module, ids) {
  const { data } = await api.post(
    `/projects/${projectId}/sections/reorder`,
    { module, ids },
  );
  return data;
}

// LocalStorage helper for collapsed-state per (user × project × module × section).
const KEY = "mm_sections_collapsed_v1";

function readMap() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMap(m) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function isCollapsed(projectId, module, sectionKey) {
  const m = readMap();
  return !!m[`${projectId || "_"}::${module}::${sectionKey}`];
}

export function setCollapsed(projectId, module, sectionKey, collapsed) {
  const m = readMap();
  const k = `${projectId || "_"}::${module}::${sectionKey}`;
  if (collapsed) m[k] = 1;
  else delete m[k];
  writeMap(m);
}
