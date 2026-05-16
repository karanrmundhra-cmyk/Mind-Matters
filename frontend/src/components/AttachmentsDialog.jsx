import React from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AnchoredPanel from "@/components/AnchoredPanel";
import {
  validateAttachment,
  usedBytes,
  formatBytes,
  MAX_ATTACHMENT_TOTAL_BYTES,
  ATTACHMENT_LIMIT_HINT,
} from "@/lib/attachments";

/**
 * AttachmentsDialog — universal popover used by Tasks / Routines / CashFlow /
 * Notes to upload, list and delete attachments on a single row.
 *
 * Props:
 *   open: boolean
 *   row:  object|null   — the row being attached to; must contain id + attachments[]
 *   module: string      — one of "tasks" | "routines" | "transactions" | "notes"
 *   label: string       — heading label ("Task" / "Routine" / etc.) for context
 *   onClose: () => void
 *   onChanged: (updatedRow) => void
 *   anchor?: HTMLElement — when present, renders as an inline popover next to
 *                          the anchor element (v2.24). When absent, falls back
 *                          to a full-screen centered modal.
 */
export default function AttachmentsDialog({
  open,
  row,
  module,
  label = "Row",
  onClose,
  onChanged,
  anchor,
}) {
  if (!open || !row) return null;

  const upload = async (file) => {
    if (!file) return;
    const err = validateAttachment(file, row.attachments || []);
    if (err) {
      toast.error(err);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/${module}/${row.id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Attachment added");
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

  const body = (
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
            Attachments
          </div>
          <div className="mm-font-display text-base mm-text-gold-bright mt-1 truncate">
            {row.task || row.activity || row.vendor || row.title || `(${label})`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition shrink-0 ml-2"
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
      {(() => {
        const used = usedBytes(row.attachments || []);
        const pct = Math.min(100, Math.round((used / MAX_ATTACHMENT_TOTAL_BYTES) * 100));
        const over = used >= MAX_ATTACHMENT_TOTAL_BYTES;
        return (
          <div className="mt-2" data-testid="attach-quota">
            <p className="text-[10px] text-[#B7A98A]/55">
              {ATTACHMENT_LIMIT_HINT}
              <span className="ml-1 text-[#B7A98A]/40">·</span>
              <span className={`ml-1 ${over ? "text-red-300" : "mm-text-gold-bright"}`}>
                Used {formatBytes(used)} / {formatBytes(MAX_ATTACHMENT_TOTAL_BYTES)}
              </span>
            </p>
            <div className="h-1 mt-1 rounded-full bg-[rgba(201,169,97,0.12)] overflow-hidden">
              <div
                className={`h-full ${over ? "bg-red-400" : "bg-gradient-to-r from-[#C9A961] to-[#E4C98C]"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}
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
                {formatBytes(a.size || 0)}
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
  );

  // Inline popover (v2.24) — anchored to the row's paperclip icon
  if (anchor) {
    return (
      <AnchoredPanel
        anchor={anchor}
        open={open}
        onClose={onClose}
        width={400}
        maxHeight="65vh"
        testId="attach-dialog"
      >
        {body}
      </AnchoredPanel>
    );
  }

  // Legacy centered modal fallback (no anchor provided)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="attach-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mm-glass rounded-2xl border border-[rgba(201,169,97,0.25)]"
      >
        {body}
      </div>
    </div>
  );
}
