import React from "react";
import { BellRing, Trash2, GripVertical } from "lucide-react";

/**
 * RowActions — shared row-right-edge action cluster.
 *
 * Props:
 *   rowId: string  — appended to each testid for unique targeting
 *   kind:  string  — "task" | "routine" | "tx" | etc. Used as testid prefix.
 *   onReminder?, onDelete
 *   onDragStart?, onDragOver?, onDrop?, onDragEnd?
 *
 * Note: explicit up/down arrows were removed in v2.6 — use the drag handle or
 * the editable Sr column on each page to reorder rows.
 */
export default function RowActions({
  rowId,
  kind = "row",
  onReminder,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggable = false,
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
