import React, { useState } from "react";
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown, Trash2, Pencil } from "lucide-react";

/**
 * SectionBar — Todoist-style collapsible row divider for Tasks / Routines /
 * CashFlow tables. Renders inline above the rows that belong to this section.
 *
 * Props:
 *   name: string                  — section title
 *   count: number                 — number of rows nested under it
 *   collapsed: boolean
 *   onToggle: () => void
 *   onRename?: (newName) => void  — section docs only (not the "No section" pseudo-row)
 *   onDelete?: () => void
 *   onUp?:    () => void
 *   onDown?:  () => void
 *   testIdPrefix: string          — e.g. "task-section" / "routine-section" / "tx-section"
 *   sectionKey: string            — stable id used in testid suffix (section id, or "none")
 *   readOnly?: boolean            — viewer/commenter role — hide rename/reorder/delete
 */
export default function SectionBar({
  name,
  count,
  collapsed,
  onToggle,
  onRename,
  onDelete,
  onUp,
  onDown,
  testIdPrefix,
  sectionKey,
  readOnly = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const submit = () => {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    onRename?.(next);
    setEditing(false);
  };

  const tid = (suffix) => `${testIdPrefix}-${sectionKey}-${suffix}`;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-[rgba(201,169,97,0.06)] border-b border-[rgba(201,169,97,0.18)] min-w-[800px] md:min-w-0 group"
      data-testid={`${testIdPrefix}-${sectionKey}`}
    >
      <button
        onClick={onToggle}
        className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition shrink-0"
        title={collapsed ? "Expand section" : "Collapse section"}
        data-testid={tid("toggle")}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(name);
              }
            }}
            className="mm-input-ghost text-[11px] uppercase tracking-[0.3em] mm-text-gold !py-0.5 w-full"
            data-testid={tid("name-input")}
          />
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && onRename && setEditing(true)}
            disabled={readOnly || !onRename}
            className={`text-[11px] uppercase tracking-[0.3em] mm-text-gold text-left w-full truncate ${
              readOnly || !onRename ? "cursor-default" : "hover:mm-text-gold-bright"
            }`}
            title={readOnly || !onRename ? "" : "Click to rename"}
            data-testid={tid("name")}
          >
            {name}
          </button>
        )}
      </div>
      <span
        className="text-[10px] text-[#B7A98A]/55 shrink-0"
        data-testid={tid("count")}
      >
        {count}
      </span>
      {!readOnly && onRename && (
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-0.5 shrink-0"
          title="Rename section"
          data-testid={tid("rename")}
        >
          <Pencil size={11} />
        </button>
      )}
      {!readOnly && onUp && (
        <button
          onClick={onUp}
          className="opacity-0 group-hover:opacity-100 text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-0.5 shrink-0"
          title="Move section up"
          data-testid={tid("up")}
        >
          <ArrowUp size={11} />
        </button>
      )}
      {!readOnly && onDown && (
        <button
          onClick={onDown}
          className="opacity-0 group-hover:opacity-100 text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-0.5 shrink-0"
          title="Move section down"
          data-testid={tid("down")}
        >
          <ArrowDown size={11} />
        </button>
      )}
      {!readOnly && onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-[#B7A98A]/55 hover:text-red-300 transition p-0.5 shrink-0"
          title="Delete section (rows stay)"
          data-testid={tid("delete")}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
