import React, { useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Universal NL input bar.
 * - placed at the top of any module page
 * - user types in natural language
 * - calls /api/parse/bulk with kind
 * - shows preview chip(s)
 * - "Confirm" → onConfirm(parsedRows)  (parent handles inserting via its CRUD)
 *
 * Props:
 *   kind: "task" | "routine" | "expense" | "loan" | "investment" | "note" | "reminder" | "deadline"
 *   placeholder
 *   onConfirm: async (rows[]) => void  // rows is JSON array
 *   describe: (row) => string  (renders a one-line preview for a row)
 */
export default function AiAddBar({ kind, placeholder, onConfirm, describe }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null); // null = no preview
  const [busy, setBusy] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/parse/bulk", { kind, text });
      const arr = data.rows || [];
      if (arr.length === 0) {
        toast.error("Could not parse — try rephrasing.");
        setRows(null);
      } else {
        setRows(arr);
      }
    } catch {
      toast.error("AI service unavailable");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      await onConfirm(rows);
      setText("");
      setRows(null);
      toast.success(`Added ${rows.length} ${kind}${rows.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to insert");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setRows(null);
  };

  return (
    <div className="mm-glass p-4" data-testid="ai-add-bar">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 mb-2">
        <Sparkles size={11} className="mm-text-gold" />
        <span>Type in plain English — AI will fill the right fields.</span>
      </div>
      <div className="flex gap-2">
        <input
          className="mm-input text-sm flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !rows) parse();
            if (e.key === "Enter" && rows) confirm();
          }}
          placeholder={placeholder}
          disabled={busy}
          data-testid="ai-add-input"
        />
        {!rows ? (
          <button
            onClick={parse}
            disabled={busy || !text.trim()}
            className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
            data-testid="ai-add-parse"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Parse
          </button>
        ) : (
          <>
            <button
              onClick={cancel}
              className="mm-btn-ghost text-sm"
              data-testid="ai-add-cancel"
            >
              <X size={14} />
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              data-testid="ai-add-confirm"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm
            </button>
          </>
        )}
      </div>

      {rows && (
        <div className="mt-3 space-y-2" data-testid="ai-add-preview">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70">
            AI parsed {rows.length} {kind}
            {rows.length > 1 ? "s" : ""} — confirm to add
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="text-sm rounded-lg border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.04)] px-3 py-2 mm-text-gold-bright"
              data-testid="ai-preview-row"
            >
              {describe ? describe(r) : JSON.stringify(r)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
