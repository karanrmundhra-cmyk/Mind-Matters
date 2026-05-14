import React, { useState } from "react";
import { api } from "@/lib/api";
import { Download } from "lucide-react";
import { toast } from "sonner";

/**
 * ExportButton — small "Export ▾" dropdown that fetches CSV/PDF for the given
 * module via /api/export/{module}.{csv|pdf} as an authenticated axios blob.
 */
export default function ExportButton({ module, label = "Export" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async (fmt) => {
    setOpen(false);
    setBusy(true);
    try {
      const { data, headers } = await api.get(`/export/${module}.${fmt}`, {
        responseType: "blob",
      });
      const mime =
        headers["content-type"] ||
        (fmt === "csv" ? "text/csv" : "application/pdf");
      const blob = new Blob([data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mind-matters-${module}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="mm-btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
        data-testid={`export-${module}-btn`}
        title="Export this module"
      >
        <Download size={12} /> {busy ? "Exporting…" : label}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-20 min-w-[120px] rounded-md border border-[rgba(201,169,97,0.25)] bg-[#0c0c0c] shadow-lg overflow-hidden"
          data-testid={`export-${module}-menu`}
        >
          <button
            onClick={() => download("csv")}
            className="block w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)]"
            data-testid={`export-${module}-csv`}
          >
            CSV
          </button>
          <button
            onClick={() => download("pdf")}
            className="block w-full text-left px-3 py-2 text-xs hover:bg-[rgba(201,169,97,0.08)]"
            data-testid={`export-${module}-pdf`}
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
