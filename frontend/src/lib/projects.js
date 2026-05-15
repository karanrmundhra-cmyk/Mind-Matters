import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const ProjectCtx = createContext(null);

const STORAGE_KEY = "mm_current_project";

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
      const stored = localStorage.getItem(STORAGE_KEY);
      const validStored = data.find((p) => p.id === stored);
      if (!validStored) {
        const def = data.find((p) => p.is_default) || data[0];
        if (def) {
          setCurrentId(def.id);
          localStorage.setItem(STORAGE_KEY, def.id);
        }
      } else {
        setCurrentId(validStored.id);
      }
    } catch {
      /* leave previous state — offline / not signed in */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // Re-load whenever auth changes (login/signup/logout).
    const onAuth = () => reload();
    window.addEventListener("mm:auth-changed", onAuth);
    return () => window.removeEventListener("mm:auth-changed", onAuth);
  }, [reload]);

  const setCurrent = useCallback((id) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Notify all listeners so axios + open pages re-query with the new id.
    window.dispatchEvent(new CustomEvent("mm:project-changed", { detail: id }));
  }, []);

  const create = useCallback(async (name, color) => {
    const { data } = await api.post("/projects", { name, color });
    await reload();
    setCurrent(data.id);
    return data;
  }, [reload, setCurrent]);

  const rename = useCallback(async (id, name, color) => {
    await api.patch(`/projects/${id}`, { name, color });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await api.delete(`/projects/${id}`);
    await reload();
  }, [reload]);

  const share = useCallback(async (id, email, role) => {
    await api.post(`/projects/${id}/share`, { email, role });
  }, []);

  const value = useMemo(
    () => ({
      projects,
      current: projects.find((p) => p.id === currentId) || null,
      currentId,
      setCurrent,
      reload,
      create,
      rename,
      remove,
      share,
      loading,
    }),
    [projects, currentId, setCurrent, reload, create, rename, remove, share, loading],
  );

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) return { projects: [], currentId: "", current: null, setCurrent: () => {} };
  return ctx;
}

/** Returns the currently selected project id (read from localStorage so axios
 *  interceptors and other module-level code can use it without React context). */
export function getCurrentProjectId() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

/** Hook for pages to re-run their loader when the active project changes. */
export function useProjectReload(loader) {
  useEffect(() => {
    if (!loader) return;
    const h = () => loader();
    window.addEventListener("mm:project-changed", h);
    return () => window.removeEventListener("mm:project-changed", h);
  }, [loader]);
}
