import React from "react";
import AnchoredPanel from "@/components/AnchoredPanel";
import { Folder, FolderMinus, Check } from "lucide-react";

/**
 * SectionPicker — anchored radio-list of sections used to move a single row
 * into or out of a section. Used by Tasks / Routines / CashFlow.
 *
 * Props:
 *   open: boolean
 *   anchor: HTMLElement
 *   onClose: () => void
 *   sections: [{ id, name, ... }]  — section docs ordered for display
 *   currentSectionId: string | null
 *   onPick: (sectionId | null) => Promise<void> | void
 */
export default function SectionPicker({ open, anchor, onClose, sections, currentSectionId, onPick }) {
  if (!open) return null;
  return (
    <AnchoredPanel
      anchor={anchor}
      open={open}
      onClose={onClose}
      width={260}
      maxHeight="60vh"
      testId="section-picker"
    >
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold mb-2">
          Move to section
        </div>
        <div className="space-y-0.5 max-h-[40vh] overflow-y-auto">
          <button
            type="button"
            onClick={async () => { await onPick(null); onClose(); }}
            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition ${
              !currentSectionId
                ? "bg-[rgba(201,169,97,0.12)] mm-text-gold-bright"
                : "hover:bg-[rgba(201,169,97,0.06)] text-[#B7A98A]/85"
            }`}
            data-testid="section-picker-option-none"
          >
            <span className="flex items-center gap-2 truncate">
              <FolderMinus size={12} className="shrink-0" /> No section
            </span>
            {!currentSectionId && <Check size={12} />}
          </button>
          {sections.length === 0 ? (
            <div className="text-[10px] text-[#B7A98A]/50 italic px-2 py-2">
              No sections yet — add one at the bottom of the table.
            </div>
          ) : (
            sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={async () => { await onPick(s.id); onClose(); }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition ${
                  currentSectionId === s.id
                    ? "bg-[rgba(201,169,97,0.12)] mm-text-gold-bright"
                    : "hover:bg-[rgba(201,169,97,0.06)] text-[#B7A98A]/85"
                }`}
                data-testid={`section-picker-option-${s.id}`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Folder size={12} className="shrink-0" />
                  <span className="truncate">{s.name}</span>
                </span>
                {currentSectionId === s.id && <Check size={12} />}
              </button>
            ))
          )}
        </div>
      </div>
    </AnchoredPanel>
  );
}
