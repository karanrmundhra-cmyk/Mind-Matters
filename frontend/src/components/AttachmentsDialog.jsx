import React from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * AttachmentsDialog — universal modal used by Tasks / Routines / CashFlow /
 * Notes to upload, list and delete attachments on a single row.
 *
 * Props:
 *   open: boolean      — when truthy, dialog renders
 *   row:  object|null  — the row being attached to; must contain id + attachments[]
 *   module: string     — one of "tasks" | "routines" | "transactions" | "notes"
 *   label: string      — heading label ("Task" / "Routine" / etc.) for context
 *   onClose: () => void
 *   onChanged: (updatedRow) => void
 */
export default function AttachmentsDialog({ open, row, module, label = "Row", onClose, onChanged }) {
  if (!open || !row) return null;

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/${module}/${row.id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Attachment added");
      // Re-fetch the updated row so the dialog reflects fresh data.
      const fresh = await api.get(`/${module}`);
      const updated = (fresh.data || []).find((x) => x.id === row.id);
      if (updated && onChanged) onChanged(updated);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    }
  };

  const remove = async (attId) => {
    try {
      await api.delete(`/${module}/${row.id}/attachments/${attId}`);
      const fresh = await api.get(`/${module}`);
      const updated = (fresh.data || []).find((x) => x.id === row.id);
      if (updated && onChanged) onChanged(updated);
    } catch {
      toast.error("Could not delete");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="attach-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mm-glass rounded-2xl border border-[rgba(201,169,97,0.25)] p-5"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
              Attachments
            </div>
            <div className="mm-font-display text-base mm-text-gold-bright mt-1 truncate max-w-[280px]">
              {row.task || row.activity || row.vendor || row.title || `(${label})`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition"
            data-testid="attach-close"
          >
            ✕
          </button>
        </div>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.xlsx,.csv,.doc,.docx"
          onChange={(e) => upload(e.target.files?.[0])}
          className="block w-full text-xs text-[#B7A98A]/70 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-[#C9A961]/40 file:bg-[rgba(201,169,97,0.08)] file:text-[#E4C98C] file:cursor-pointer file:text-xs"
          data-testid="attach-input"
        />
        <p className="text-[10px] text-[#B7A98A]/45 mt-2">
          Up to 10MB per file · 10 files max · jpg, png, pdf, xlsx, csv, doc, docx.
        </p>
        <div className="mt-4 space-y-2 max-h-[40vh] overflow-y-auto">
          {(row.attachments || []).length === 0 ? (
            <div className="text-xs text-[#B7A98A]/50 py-3 text-center">No attachments yet.</div>
          ) : (
            (row.attachments || []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(201,169,97,0.15)] px-3 py-2"
                data-testid="attach-item"
              >
                <a
                  href={a.data_url}
                  download={a.name}
                  className="flex-1 min-w-0 text-xs mm-text-gold-bright hover:underline truncate"
                  title={a.name}
                >
                  {a.name}
                </a>
                <span className="text-[10px] text-[#B7A98A]/45 shrink-0">
                  {(a.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => remove(a.id)}
                  className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition text-xs"
                  data-testid="attach-delete"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
