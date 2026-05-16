import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Download, Filter, List } from "lucide-react";
import { toast } from "sonner";

/**
 * ExportButton — "Export ▾" dropdown that downloads CSV / PDF for the given
 * module via /api/export/{module}.{csv|pdf} as an authenticated axios blob.
 *
 * Filtered export (v2.24):
 *   - When `filteredIds` is non-empty AND is a strict subset of `totalCount`,
 *     the menu shows two rows for each format:
 *       • "Filtered (N)"  → appends ?ids=<comma-list>
 *       • "All (M)"       → no ids param
 *   - When everything is visible (or filteredIds not provided), only the
 *     standard CSV / PDF rows are shown.
 */
export default function ExportButton({ module, label = "Export", filteredIds, totalCount }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const filteredArr = Array.isArray(filteredIds) ? filteredIds.filter(Boolean) : null;
  const total = typeof totalCount === "number" ? totalCount : (filteredArr?.length ?? 0);
  const isFiltered = filteredArr != null && total > 0 && filteredArr.length < total;

  const download = async (fmt, useFilter) => {
    setOpen(false);
    setBusy(true);
    try {
      let url = `/export/${module}.${fmt}`;
      if (useFilter && filteredArr && filteredArr.length > 0) {
        const ids = filteredArr.join(",");
        url += `?ids=${encodeURIComponent(ids)}`;
      }
      const { data, headers } = await api.get(url, { responseType: "blob" });
      const mime =
        headers["content-type"] || (fmt === "csv" ? "text/csv" : "application/pdf");
      const blob = new Blob([data], { type: mime });
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const suffix = useFilter && isFiltered ? "-filtered" : "";
      a.download = `mind-matters-${module}${suffix}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  // When no filter is active, simple two-row menu.
  // When filter is active, show four rows: Filtered CSV / All CSV / Filtered PDF / All PDF.
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="mm-btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
        data-testid={`export-${module}-btn`}
        title={isFiltered ? `Export — filter active (${filteredArr.length}/${total})` : "Export this module"}
      >
        <Download size={12} /> {busy ? "Exporting…" : label}
        {isFiltered && (
          <span
            className="ml-1 text-[9px] uppercase tracking-[0.18em] px-1 py-0.5 rounded bg-[rgba(201,169,97,0.14)] border border-[rgba(201,169,97,0.3)] mm-text-gold-bright"
            data-testid={`export-${module}-filter-chip`}
          >
            {filteredArr.length}/{total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-30 min-w-[200px] rounded-md border border-[rgba(201,169,97,0.25)] bg-[#0c0c0c] shadow-2xl overflow-hidden"
          data-testid={`export-${module}-menu`}
        >
          {!isFiltered ? (
            <>
              <button
                onClick={() => download("csv", false)}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)]"
                data-testid={`export-${module}-csv`}
              >
                CSV
              </button>
              <button
                onClick={() => download("pdf", false)}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)]"
                data-testid={`export-${module}-pdf`}
              >
                PDF
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.3em] text-[#B7A98A]/55 bg-[rgba(201,169,97,0.05)] border-b border-[rgba(201,169,97,0.12)]">
                <Filter size={9} className="inline mr-1" /> Visible rows · {filteredArr.length}
              </div>
              <button
                onClick={() => download("csv", true)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)] flex items-center justify-between"
                data-testid={`export-${module}-csv-filtered`}
              >
                <span>CSV (filtered)</span>
                <span className="text-[10px] text-[#B7A98A]/50">{filteredArr.length}</span>
              </button>
              <button
                onClick={() => download("pdf", true)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)] flex items-center justify-between"
                data-testid={`export-${module}-pdf-filtered`}
              >
                <span>PDF (filtered)</span>
                <span className="text-[10px] text-[#B7A98A]/50">{filteredArr.length}</span>
              </button>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.3em] text-[#B7A98A]/55 bg-[rgba(201,169,97,0.05)] border-y border-[rgba(201,169,97,0.12)]">
                <List size={9} className="inline mr-1" /> All rows · {total}
              </div>
              <button
                onClick={() => download("csv", false)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)] flex items-center justify-between"
                data-testid={`export-${module}-csv`}
              >
                <span>CSV (all)</span>
                <span className="text-[10px] text-[#B7A98A]/50">{total}</span>
              </button>
              <button
                onClick={() => download("pdf", false)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)] flex items-center justify-between"
                data-testid={`export-${module}-pdf`}
              >
                <span>PDF (all)</span>
                <span className="text-[10px] text-[#B7A98A]/50">{total}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
