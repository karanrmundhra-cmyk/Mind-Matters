import React from "react";
import { ArrowUp, ArrowDown, BellRing, Trash2, GripVertical, Paperclip, ListPlus, Flag } from "lucide-react";

/**
 * RowActions — shared row-right-edge action cluster.
 *
 * Props:
 *   rowId: string  — appended to each testid for unique targeting
 *   kind:  string  — "task" | "routine" | "tx" | etc. Used as testid prefix.
 *   onReminder?, onDelete, onUp?, onDown?
 *   onDragStart?, onDragOver?, onDrop?, onDragEnd?
 *   onAttach?, attachmentCount? — paperclip icon (optional)
 *   onSubtask? — "+ subtask" icon (optional; tasks page only)
 *   onFlag?, flagged? — priority flag toggle (gold when flagged)
 */
export default function RowActions({
  rowId,
  kind = "row",
  onReminder,
  onDelete,
  onUp,
  onDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggable = false,
  onAttach,
  attachmentCount = 0,
  onSubtask,
  onFlag,
  flagged = false,
}) {
  const tid = (name) => (rowId ? `${kind}-${name}-${rowId}` : `${kind}-${name}`);
  return (
    <div className="flex items-center gap-1 justify-self-end">
      {draggable && (
        <span
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          className="text-[#B7A98A]/40 hover:text-[#E4C98C] cursor-grab active:cursor-grabbing px-0.5"
          title="Drag to reorder"
          data-testid={tid("drag")}
        >
          <GripVertical size={13} />
        </span>
      )}
      {onUp && (
        <button
          type="button"
          onClick={onUp}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1 leading-none"
          title="Move up — Sr number updates automatically"
          data-testid={tid("up")}
        >
          <ArrowUp size={12} />
        </button>
      )}
      {onDown && (
        <button
          type="button"
          onClick={onDown}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1 leading-none"
          title="Move down — Sr number updates automatically"
          data-testid={tid("down")}
        >
          <ArrowDown size={12} />
        </button>
      )}
      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1 relative"
          title={attachmentCount ? `${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}` : "Add attachment"}
          data-testid={tid("attach")}
        >
          <Paperclip size={13} />
          {attachmentCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 text-[8px] font-semibold mm-text-gold-bright bg-black border border-[#C9A961] rounded-full w-3 h-3 flex items-center justify-center leading-none"
              data-testid={tid("attach-count")}
            >
              {attachmentCount}
            </span>
          )}
        </button>
      )}
      {onSubtask && (
        <button
          type="button"
          onClick={onSubtask}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1"
          title="Add subtask"
          data-testid={tid("subtask")}
        >
          <ListPlus size={13} />
        </button>
      )}
      {onFlag && (
        <button
          type="button"
          onClick={onFlag}
          className={`transition p-1 ${
            flagged
              ? "mm-text-gold-bright drop-shadow-[0_0_4px_rgba(228,201,140,0.5)]"
              : "text-[#B7A98A]/45 hover:text-[#E4C98C]"
          }`}
          title={flagged ? "Un-flag" : "Priority flag — pin to top"}
          data-testid={tid("flag")}
        >
          <Flag size={13} fill={flagged ? "currentColor" : "none"} />
        </button>
      )}
      {onReminder && (
        <button
          type="button"
          onClick={onReminder}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1"
          title="Set reminder / alarm"
          data-testid={tid("reminder")}
        >
          <BellRing size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1"
        title="Delete"
        data-testid={tid("delete")}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
