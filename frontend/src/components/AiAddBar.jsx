import React, { useRef, useState } from "react";
import { Sparkles, Check, X, Loader2, Trash2, Mic, MicOff } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Voice → text dictation hook. Wraps the Web Speech API. Falls back gracefully
 * when the browser doesn't support it (Safari iOS, Firefox).
 */
function useDictation(onResult) {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);

  const supported = typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    if (!supported) {
      toast.error("Voice input not supported on this browser — try Chrome/Edge");
      return;
    }
    const Cls = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Cls();
    rec.lang = (navigator.language || "en-US");
    rec.interimResults = true;
    rec.continuous = false;
    let finalTranscript = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      onResult((finalTranscript + interim).trim(), e.results[e.results.length - 1].isFinal);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recogRef.current = rec;
    setListening(true);
  };
  const stop = () => {
    try { recogRef.current?.stop(); } catch { /* */ }
    setListening(false);
  };
  return { start, stop, listening, supported };
}

/**
 * Universal NL input bar with editable confirmation preview + quick-tag chips.
 *
 * Props:
 *   kind: "task" | "routine" | "expense" | "loan" | "investment" | "note" | "reminder" | "deadline"
 *   placeholder
 *   onConfirm: async (rows[]) => void
 *   columns: [{key,label,type,width,options?}]  (optional but preferred)
 *   describe: (row) => string  (fallback if columns is missing)
 *   quickTags?: string[]  — tappable pills prepended to the input (groups / hashtags etc.)
 *   quickTagPrefix?: string  — inserted before each tapped tag (e.g. "#" or "Group: ")
 */
export default function AiAddBar({ kind, placeholder, onConfirm, describe, columns, quickTags, quickTagPrefix = "", decorateRows }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null); // null = no preview, otherwise editable
  const [busy, setBusy] = useState(false);
  const dictation = useDictation((transcript) => setText(transcript));

  const parse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/parse/bulk", { kind, text });
      const arr = data.rows || [];
      const decorated = typeof decorateRows === "function" ? decorateRows(arr) : arr;
      if (decorated.length === 0) {
        toast.error("Could not parse — try rephrasing.");
        setRows(null);
      } else {
        setRows(decorated);
      }
    } catch {
      toast.error("AI service unavailable");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!rows?.length) return;
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

  const cancel = () => setRows(null);

  const updateCell = (i, key, val) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  const removeRow = (i) => {
    setRows((rs) => {
      const next = rs.filter((_, idx) => idx !== i);
      return next.length ? next : null;
    });
  };

  // Build a CSS grid template that mirrors the page's table layout
  const gridTemplate = columns
    ? columns.map((c) => c.width || "1fr").join(" ") + " 40px"
    : null;

  return (
    <div className="mm-glass p-4" data-testid="ai-add-bar">
      {quickTags && quickTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" data-testid="ai-quick-tags">
          {quickTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                const prefix = quickTagPrefix || "";
                const bit = `${prefix}${t}`;
                setText((prev) => (prev ? `${prev} ${bit}` : bit));
              }}
              className="text-[11px] px-2 py-1 rounded-full border border-[rgba(201,169,97,0.25)] text-[#B7A98A]/80 hover:border-[#C9A961] hover:mm-text-gold-bright transition"
              data-testid={`ai-quick-tag-${t.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {quickTagPrefix}{t}
            </button>
          ))}
        </div>
      )}
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
        {dictation.supported && (
          <button
            type="button"
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
            className={`mm-btn-ghost px-3 ${dictation.listening ? "border-[#E4C98C] mm-text-gold-bright" : ""}`}
            title={dictation.listening ? "Stop dictation" : "Dictate (voice input)"}
            data-testid="ai-add-mic"
          >
            {dictation.listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}
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
              className="mm-btn-ghost text-sm flex items-center gap-1.5"
              data-testid="ai-add-cancel"
            >
              <X size={14} /> Discard
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              data-testid="ai-add-confirm"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm & save
            </button>
          </>
        )}
      </div>

      {rows && (
        <div className="mt-4 rounded-xl border border-[rgba(201,169,97,0.28)] bg-[rgba(201,169,97,0.04)] overflow-hidden" data-testid="ai-add-preview">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(201,169,97,0.18)]">
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
              AI parsed {rows.length} record{rows.length > 1 ? "s" : ""} — edit if needed, then confirm
            </div>
          </div>

          {columns ? (
            <div className="overflow-x-auto">
              {/* Header */}
              <div
                className="hidden md:grid gap-3 px-4 py-2 border-b border-[rgba(201,169,97,0.14)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {columns.map((c) => (
                  <div key={c.key}>{c.label}</div>
                ))}
                <div />
              </div>
              {rows.map((r, i) => (
                <div
                  key={`row-${i}`}
                  className="grid grid-cols-2 md:gap-3 gap-2 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] last:border-b-0 items-center"
                  style={{ gridTemplateColumns: gridTemplate ? gridTemplate : undefined }}
                  data-testid="ai-preview-row"
                >
                  {columns.map((c) => {
                    const val = r[c.key] ?? "";
                    const common =
                      "mm-input text-xs !py-1.5 w-full";
                    const cellKey = `${i}-${c.key}`;
                    if (c.type === "date") {
                      return (
                        <input
                          key={cellKey}
                          type="date"
                          value={val || ""}
                          onChange={(e) => updateCell(i, c.key, e.target.value)}
                          className={common}
                        />
                      );
                    }
                    if (c.type === "number") {
                      return (
                        <input
                          key={cellKey}
                          type="number"
                          value={val || ""}
                          onChange={(e) => updateCell(i, c.key, e.target.value)}
                          className={common}
                          placeholder={c.label}
                        />
                      );
                    }
                    if (c.type === "select") {
                      return (
                        <select
                          key={cellKey}
                          value={val || ""}
                          onChange={(e) => updateCell(i, c.key, e.target.value)}
                          className={common}
                        >
                          {(c.options || []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        key={cellKey}
                        type="text"
                        value={val || ""}
                        onChange={(e) => updateCell(i, c.key, e.target.value)}
                        className={common}
                        placeholder={c.label}
                      />
                    );
                  })}
                  <button
                    key={`rm-${i}`}
                    onClick={() => removeRow(i)}
                    className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                    data-testid="ai-preview-remove"
                    title="Remove row"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="text-sm rounded-lg border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.04)] px-3 py-2 mm-text-gold-bright flex items-center justify-between"
                  data-testid="ai-preview-row"
                >
                  <span>{describe ? describe(r) : JSON.stringify(r)}</span>
                  <button
                    onClick={() => removeRow(i)}
                    className="text-[#B7A98A]/55 hover:text-[#E4C98C]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
