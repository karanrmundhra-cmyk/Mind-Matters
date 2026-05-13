import React from "react";
import { ArrowUp, ArrowDown, BellRing, Trash2, GripVertical } from "lucide-react";

/**
 * RowActions — shared row-right-edge action cluster.
 *
 * Props:
 *   rowId: string  — appended to each testid for unique targeting
 *   kind:  string  — "task" | "routine" | "tx" | etc. Used as testid prefix.
 *   onReminder?, onDelete, onUp?, onDown?
 *   onDragStart?, onDragOver?, onDrop?, onDragEnd?
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
