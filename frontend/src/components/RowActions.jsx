import React from "react";
import { ArrowUp, ArrowDown, BellRing, Trash2, GripVertical, Paperclip, ListPlus, Flag, MessageSquare } from "lucide-react";

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
  onAttachFile,
  attachmentCount = 0,
  onSubtask,
  onFlag,
  flagged = false,
  onComment,
  commentCount = 0,
}) {
  const tid = (name) => (rowId ? `${kind}-${name}-${rowId}` : `${kind}-${name}`);
  return (
    <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 justify-self-end items-center w-[84px]">
      {draggable ? (
        <span
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          className="text-[#B7A98A]/40 hover:text-[#E4C98C] cursor-grab active:cursor-grabbing p-1 flex items-center justify-center"
          title="Drag to reorder"
          data-testid={tid("drag")}
        >
          <GripVertical size={13} />
        </span>
      ) : <span />}
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
          onDragOver={(e) => {
            if (!onAttach) return;
            e.preventDefault();
            e.currentTarget.classList.add("ring-2", "ring-[#C9A961]");
          }}
          onDragLeave={(e) =>
            e.currentTarget.classList.remove("ring-2", "ring-[#C9A961]")
          }
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("ring-2", "ring-[#C9A961]");
            const f = e.dataTransfer?.files?.[0];
            if (f && onAttachFile) onAttachFile(f);
          }}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1 relative rounded"
          title={attachmentCount ? `${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""} · drop to add` : "Add attachment (drop a file or click)"}
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
      {onComment && (
        <button
          type="button"
          onClick={onComment}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1 relative"
          title={commentCount ? `${commentCount} comment${commentCount !== 1 ? "s" : ""} · click to open thread` : "Add comment"}
          data-testid={tid("comment")}
        >
          <MessageSquare size={13} />
          {commentCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 text-[8px] font-semibold mm-text-gold-bright bg-black border border-[#C9A961] rounded-full w-3 h-3 flex items-center justify-center leading-none"
              data-testid={tid("comment-count")}
            >
              {commentCount}
            </span>
          )}
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
