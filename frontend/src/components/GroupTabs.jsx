import React from "react";
import { Plus } from "lucide-react";

/**
 * GroupTabs — clickable pill tabs for custom-named groups.
 * The active group filters the visible table; new groups are created implicitly
 * when the user types one into an entry row.
 *
 * Props:
 *   groups: string[]  (distinct non-empty group names)
 *   active: string    (currently selected; "" = All)
 *   onChange: (next: string) => void
 *   onAdd?: () => void   — optional "+ Add group" button opens a prompt
 */
export default function GroupTabs({ groups = [], active = "", onChange, onAdd }) {
  return (
    <div className="flex flex-wrap gap-2 items-center" data-testid="group-tabs">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`text-xs px-3 py-1.5 rounded-full border transition ${
          active === ""
            ? "border-[#C9A961] mm-text-gold-bright bg-[rgba(201,169,97,0.08)]"
            : "border-[rgba(201,169,97,0.2)] text-[#B7A98A]/65 hover:border-[#C9A961]/50"
        }`}
        data-testid="group-tab-all"
      >
        All
      </button>
      {groups.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={`text-xs px-3 py-1.5 rounded-full border transition capitalize ${
            active === g
              ? "border-[#C9A961] mm-text-gold-bright bg-[rgba(201,169,97,0.08)]"
              : "border-[rgba(201,169,97,0.2)] text-[#B7A98A]/65 hover:border-[#C9A961]/50"
          }`}
          data-testid={`group-tab-${g.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {g}
        </button>
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-[rgba(201,169,97,0.28)] text-[#B7A98A]/70 hover:border-[#C9A961]/60 hover:text-[#E4C98C] flex items-center gap-1 transition"
          data-testid="group-add-new"
        >
          <Plus size={11} /> New group
        </button>
      )}
    </div>
  );
}
