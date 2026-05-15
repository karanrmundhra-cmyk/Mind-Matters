import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Users, Settings as Cog, Check, FolderPlus } from "lucide-react";
import { useProjects } from "@/lib/projects";
import ShareDialog from "@/components/ShareDialog";
import { toast } from "sonner";

export default function ProjectSelector() {
  const { projects, currentId, current, setCurrent, create, rename, remove } = useProjects();
  const [open, setOpen] = useState(false);
  const [shareFor, setShareFor] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCreate = async () => {
    const name = window.prompt("Project name?");
    if (!name || !name.trim()) return;
    try {
      await create(name.trim());
      toast.success(`Project "${name.trim()}" created`);
      setOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create");
    }
  };

  const handleRename = async (p) => {
    const next = window.prompt("Rename project to:", p.name);
    if (!next || !next.trim() || next.trim() === p.name) return;
    try {
      await rename(p.id, next.trim(), p.color);
      toast.success("Renamed");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not rename");
    }
  };

  const handleDelete = async (p) => {
    if (p.is_default) return toast.error("Cannot delete the default project");
    if (!window.confirm(`Delete project "${p.name}"? All rows will move to the default project.`)) return;
    try {
      await remove(p.id);
      toast.success("Project deleted");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete");
    }
  };

  if (!current) {
    return null;
  }

  return (
    <div className="relative" ref={wrapRef} data-testid="project-selector">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.05)] hover:bg-[rgba(201,169,97,0.1)] transition text-xs"
        data-testid="project-selector-btn"
        title="Switch project"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: current.color || "#C9A961" }}
        />
        <span className="mm-font-display mm-text-gold-bright max-w-[140px] truncate">
          {current.name}
        </span>
        {current.shared && (
          <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded bg-[rgba(122,184,255,0.15)] text-[#7AB8FF] border border-[rgba(122,184,255,0.3)]">
            Shared
          </span>
        )}
        <ChevronDown size={12} className="text-[#B7A98A]/60" />
      </button>

      {open && (
        <div
          className="absolute z-50 right-0 mt-2 w-72 mm-glass rounded-xl border border-[rgba(201,169,97,0.25)] shadow-2xl overflow-hidden"
          data-testid="project-dropdown"
        >
          <div className="px-3 py-2 border-b border-[rgba(201,169,97,0.15)]">
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold/80">
              Projects
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto py-1">
            {projects.map((p) => {
              const isActive = p.id === currentId;
              return (
                <div
                  key={p.id}
                  className={`group px-3 py-2 flex items-center gap-2 cursor-pointer transition ${
                    isActive
                      ? "bg-[rgba(201,169,97,0.1)]"
                      : "hover:bg-[rgba(201,169,97,0.05)]"
                  }`}
                  data-testid={`project-item-${p.id}`}
                  data-active={isActive ? "1" : "0"}
                  onClick={() => {
                    setCurrent(p.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || "#C9A961" }}
                  />
                  <span className="flex-1 text-xs mm-text-gold-bright truncate">
                    {p.name}
                  </span>
                  {p.shared && (
                    <span
                      className="text-[9px] uppercase tracking-wider text-[#7AB8FF]"
                      title={`${p.member_count} member${p.member_count !== 1 ? "s" : ""}`}
                    >
                      Shared
                    </span>
                  )}
                  {p.is_default && (
                    <span className="text-[9px] uppercase tracking-wider text-[#B7A98A]/55">
                      Default
                    </span>
                  )}
                  {isActive && (
                    <Check size={12} className="text-[#E4C98C]" />
                  )}
                  {p.role === "admin" && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShareFor(p)}
                        className="p-1 rounded hover:bg-[rgba(201,169,97,0.15)] text-[#B7A98A]/65 hover:text-[#E4C98C]"
                        title="Share / manage members"
                        data-testid={`project-share-${p.id}`}
                      >
                        <Users size={11} />
                      </button>
                      <button
                        onClick={() => handleRename(p)}
                        className="p-1 rounded hover:bg-[rgba(201,169,97,0.15)] text-[#B7A98A]/65 hover:text-[#E4C98C]"
                        title="Rename"
                      >
                        <Cog size={11} />
                      </button>
                      {!p.is_default && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 rounded hover:bg-[rgba(255,100,100,0.15)] text-[#B7A98A]/65 hover:text-red-300"
                          title="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={handleCreate}
            className="w-full px-3 py-2.5 text-xs flex items-center gap-2 border-t border-[rgba(201,169,97,0.15)] text-[#E4C98C] hover:bg-[rgba(201,169,97,0.08)] transition"
            data-testid="project-create-btn"
          >
            <FolderPlus size={13} />
            <span>New project…</span>
            <Plus size={11} className="ml-auto opacity-60" />
          </button>
        </div>
      )}

      <ShareDialog
        project={shareFor}
        onClose={() => setShareFor(null)}
      />
    </div>
  );
}
