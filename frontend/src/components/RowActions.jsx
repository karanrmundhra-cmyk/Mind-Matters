import React from "react";
import { ArrowUp, ArrowDown, BellRing, Trash2, GripVertical } from "lucide-react";

/**
 * RowActions — shared row-right-edge action cluster.
 *
 * Props:
 *   onReminder?: () => void  — opens reminder-create dialog
 *   onDelete: () => void
 *   onUp?:   () => void
 *   onDown?: () => void
 *   onDragStart?, onDragOver?, onDrop?, onDragEnd?  — native DnD handlers
 *   testId?: string  — prefix (falls back to "row-action")
 */
export default function RowActions({
  onReminder,
  onDelete,
  onUp,
  onDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggable = false,
  testId = "row",
}) {
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
          data-testid={`${testId}-drag`}
        >
          <GripVertical size={13} />
        </span>
      )}
      {onUp && (
        <button
          type="button"
          onClick={onUp}
          className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1 leading-none"
          title="Move up"
          data-testid={`${testId}-up`}
        >
          <ArrowUp size={12} />
        </button>
      )}
      {onDown && (
        <button
          type="button"
          onClick={onDown}
          className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1 leading-none"
          title="Move down"
          data-testid={`${testId}-down`}
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
          data-testid={`${testId}-reminder`}
        >
          <BellRing size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1"
        title="Delete"
        data-testid={`${testId}-delete`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
