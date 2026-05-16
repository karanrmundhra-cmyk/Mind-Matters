import React, { useState } from "react";
import { Plus, X, Check } from "lucide-react";

/**
 * AddSectionButton — small inline "+ Add section" trigger that expands into
 * a name input + Confirm/Cancel buttons. Used at the bottom of Tasks /
 * Routines / CashFlow tables.
 *
 * Props:
 *   onCreate: async (name) => void  — called after the user confirms
 *   testIdPrefix: string             — e.g. "task" / "routine" / "tx"
 *   disabled?: boolean               — disable when no project selected / read-only
 *   disabledHint?: string            — tooltip for the disabled state
 */
export default function AddSectionButton({
  onCreate,
  testIdPrefix,
  disabled = false,
  disabledHint = "",
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onCreate(trimmed);
      setName("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <div
        className="px-4 py-2 border-t border-[rgba(201,169,97,0.08)] min-w-[800px] md:min-w-0"
        data-testid={`${testIdPrefix}-add-section-disabled`}
      >
        <button
          disabled
          title={disabledHint || "Sections require a project"}
          className="text-[11px] uppercase tracking-[0.3em] text-[#B7A98A]/35 cursor-not-allowed flex items-center gap-1.5"
        >
          <Plus size={11} /> Add section
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="px-4 py-2 border-t border-[rgba(201,169,97,0.08)] min-w-[800px] md:min-w-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] uppercase tracking-[0.3em] text-[#B7A98A]/55 hover:mm-text-gold-bright transition flex items-center gap-1.5"
          data-testid={`${testIdPrefix}-add-section-open`}
        >
          <Plus size={11} /> Add section
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-t border-[rgba(201,169,97,0.08)] flex items-center gap-2 bg-[rgba(201,169,97,0.04)] min-w-[800px] md:min-w-0">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Section name (e.g. MORNING)"
        className="mm-input text-[11px] uppercase tracking-[0.2em] !py-1 flex-1"
        data-testid={`${testIdPrefix}-add-section-input`}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !name.trim()}
        className="mm-btn-primary text-[10px] !py-1 !px-2 flex items-center gap-1 disabled:opacity-40"
        data-testid={`${testIdPrefix}-add-section-confirm`}
      >
        <Check size={11} /> Add
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
        className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1"
        data-testid={`${testIdPrefix}-add-section-cancel`}
      >
        <X size={12} />
      </button>
    </div>
  );
}
