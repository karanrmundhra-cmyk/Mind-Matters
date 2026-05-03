import React, { useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";

/**
 * FilterHeader — column header with a filter dropdown (Excel-style).
 * Click the filter icon to open a small popover with a search input and
 * optionally a list of distinct values to pick from.
 *
 * Props:
 *   label: string
 *   value: string — current filter value
 *   onChange: (v: string) => void
 *   options?: string[] — distinct values to surface as one-click picks
 *   align?: "left" | "right"
 *   testId?: string
 */
export default function FilterHeader({
  label,
  value = "",
  onChange,
  options = [],
  align = "left",
  testId,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = Boolean(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`p-0.5 leading-none transition ${
          active ? "mm-text-gold-bright" : "text-[#B7A98A]/45 hover:text-[#E4C98C]"
        }`}
        title={active ? `Filtered: ${value}` : "Filter"}
        data-testid={testId || `filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Filter size={10} fill={active ? "currentColor" : "none"} />
      </button>
      {open && (
        <div
          ref={ref}
          className={`absolute top-5 z-30 w-56 mm-glass p-2 rounded-lg shadow-2xl normal-case tracking-normal ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Filter by ${label.toLowerCase()}…`}
            className="mm-input text-xs !py-1.5"
            data-testid={`${testId || "filter"}-input`}
          />
          {options.length > 0 && (
            <div className="mt-1.5 max-h-44 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-[rgba(201,169,97,0.08)] text-[#B7A98A]/70"
              >
                Clear
              </button>
              {options.slice(0, 40).map((o) => (
                <button
                  type="button"
                  key={o}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-[rgba(201,169,97,0.08)] mm-text-gold-bright truncate"
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
