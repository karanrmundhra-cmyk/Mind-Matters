import React, { useRef, useState } from "react";
import { X, Upload, Sparkles, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Bulk add dialog: paste TSV/CSV/raw text or upload .xlsx/.csv.
 * AI normalizes to JSON array per the kind's schema.
 * Then preview rows and confirm.
 *
 * Props:
 *   open, onClose
 *   kind
 *   onConfirm: async (rows[]) => void
 *   columns?: [{key,label,type,options?}]  — when provided, preview shows
 *             every column as a labeled cell (no truncation, all fields
 *             visible before confirm)
 *   describe?: (row) => string  — fallback short summary when columns isn't
 *             provided
 */
export default function BulkAddDialog({ open, onClose, kind, onConfirm, describe, columns }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const reset = () => {
    setText("");
    setRows([]);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const parseText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/parse/bulk", { kind, text });
      let parsed = data.rows || [];
      if (parsed.length > 50) {
        toast.info(`Processing first 50 of ${parsed.length} entries.`);
        parsed = parsed.slice(0, 50);
      }
      setRows(parsed);
      if (!parsed.length) toast.error("Could not parse");
    } catch {
      toast.error("AI failed");
    } finally {
      setBusy(false);
    }
  };

  const parseFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const { data } = await api.post("/parse/bulk-file", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      let parsed = data.rows || [];
      if (parsed.length > 50) {
        toast.info(`Processing first 50 of ${parsed.length} entries.`);
        parsed = parsed.slice(0, 50);
      }
      setRows(parsed);
      if (!parsed.length) toast.error("Could not parse file");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const [dragActive, setDragActive] = useState(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const lower = (file.name || "").toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv")) {
      toast.error("Drop a .xlsx, .xls or .csv file");
      return;
    }
    parseFile(file);
  };

  const confirm = async () => {
    if (!rows.length) return;
    setBusy(true);
    try {
      await onConfirm(rows);
      toast.success(`Added ${rows.length} record(s)`);
      close();
    } catch (e) {
      toast.error("Failed to insert");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/50 backdrop-blur-sm mm-fade-in"
      onClick={close}
      data-testid="bulk-add-backdrop"
    >
      <div
        className="mm-glass w-[95%] max-w-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="bulk-add-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={16} className="mm-text-gold" />
            <div className="mm-font-display text-base mm-text-gold-bright">
              Import — {kind}
            </div>
          </div>
          <button onClick={close} className="text-[#B7A98A]/60 hover:text-[#E4C98C]">
            <X size={16} />
          </button>
        </div>

        {rows.length === 0 ? (
          <>
            <div className="text-xs text-[#B7A98A]/65 mb-3">
              Import up to <span className="mm-text-gold-bright">50 entries</span> at a time.
              Paste rows below (any format — Excel paste, CSV, plain English, one per line),
              upload a spreadsheet, or <span className="mm-text-gold">drag & drop</span> a file
              anywhere on this box.
            </div>
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`relative rounded-lg transition border-2 ${
                dragActive ? "border-dashed border-[#E4C98C] bg-[rgba(201,169,97,0.06)]" : "border-transparent"
              }`}
              data-testid="bulk-add-dropzone"
            >
              {dragActive && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center text-sm mm-text-gold-bright">
                  Drop .xlsx / .csv to upload
                </div>
              )}
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  kind === "task"
                    ? "follow up brinda on bar unit #Personal"
                    : kind === "routine"
                      ? "morning walk at park daily, self #Morning"
                      : kind === "expense"
                        ? "insurance from bajaj karan 5 lakhs #Family"
                        : kind === "note"
                          ? "add butter to shopping list #Personal"
                          : "One record per line — AI will parse"
                }
                className="mm-input text-sm font-mono"
                data-testid="bulk-add-textarea"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => parseFile(e.target.files?.[0])}
              data-testid="bulk-add-file-input"
            />
            <div className="mt-4 flex flex-wrap gap-2 justify-between">
              <button
                onClick={() => fileRef.current?.click()}
                className="mm-btn-ghost text-xs flex items-center gap-2"
                data-testid="bulk-add-upload"
              >
                <Upload size={12} /> Upload .xlsx / .csv
              </button>
              <button
                onClick={parseText}
                disabled={busy || !text.trim()}
                className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                data-testid="bulk-add-parse"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Parse with AI
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-[#B7A98A]/65 mb-3">
              AI parsed {rows.length} record(s). Review every field below — confirm to add all.
              <span className="block mt-1 text-[#B7A98A]/45 italic">
                Entries can be edited from the {kind === "task" ? "Task" : kind === "routine" ? "Routine" : kind === "note" ? "Notes" : "main"} sheet after adding.
              </span>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.04)] p-3"
                  data-testid="bulk-preview-row"
                >
                  {columns && columns.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {columns.map((c) => {
                        const v = r[c.key];
                        const display =
                          v === null || v === undefined || v === ""
                            ? "—"
                            : Array.isArray(v)
                              ? v.join(", ")
                              : String(v);
                        return (
                          <div key={c.key} className="min-w-0">
                            <div className="text-[9px] uppercase tracking-[0.25em] text-[#B7A98A]/55 mb-0.5">
                              {c.label}
                            </div>
                            <div
                              className={`text-xs break-words ${
                                display === "—" ? "text-[#B7A98A]/40" : "mm-text-gold-bright"
                              }`}
                            >
                              {display}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm mm-text-gold-bright" data-testid="bulk-preview-summary">
                      {describe ? describe(r) : JSON.stringify(r)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRows([])} className="mm-btn-ghost text-sm">
                Back
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                data-testid="bulk-add-confirm"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm all
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
