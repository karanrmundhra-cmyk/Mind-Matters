import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function QuickAdd({ open, onClose, defaultKind = "task" }) {
  const [kind, setKind] = useState(defaultKind);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const msg = text.trim();
    if (!msg) return;
    setLoading(true);
    try {
      const { data } = await api.post("/ai/parse", { text: msg, kind });
      const parsed = data.parsed;
      if (!parsed) throw new Error("AI could not parse");

      const actualKind = parsed.kind || kind;
      if (actualKind === "task") {
        await api.post("/tasks", {
          task: parsed.task || msg,
          name: parsed.name || "",
          details: parsed.details || "",
          date: parsed.date || null,
          status: parsed.status || "Pending",
        });
        toast.success("Task added");
      } else if (actualKind === "expense") {
        await api.post("/transactions", {
          amount: Number(parsed.amount) || 0,
          expense_head: parsed.expense_head || "Uncategorized",
          company: parsed.company || "",
          direction: parsed.direction || "out",
          date: parsed.date || null,
          mode: parsed.mode || "Cash",
          notes: parsed.notes || "",
        });
        toast.success("Expense logged");
      } else if (actualKind === "note") {
        await api.post("/notes", {
          title: parsed.title || msg.slice(0, 40),
          body: parsed.body || msg,
          tags: parsed.tags || [],
        });
        toast.success("Note saved");
      } else {
        toast.error("Could not understand — try again.");
      }
      setText("");
      onClose();
    } catch (e) {
      toast.error("Quick-add failed");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm mm-fade-in"
      onClick={onClose}
      data-testid="quick-add-backdrop"
    >
      <div
        className="mm-glass w-[92%] max-w-xl p-5"
        onClick={(e) => e.stopPropagation()}
        data-testid="quick-add-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={1.5} />
            <div className="mm-font-display text-base">Quick add</div>
          </div>
          <button onClick={onClose} className="text-white/50" data-testid="quick-add-close">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {["task", "expense", "note"].map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              data-testid={`quick-add-kind-${k}`}
              className={`px-3 py-1.5 rounded-full text-xs capitalize transition ${
                kind === k
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/70 hover:bg-white/5"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.metaKey && submit()}
          placeholder={
            kind === "task"
              ? "Remind Rahul to send invoice tomorrow"
              : kind === "expense"
                ? "Spent 450 at Starbucks on coffee"
                : "Idea: build a weekly review ritual..."
          }
          rows={3}
          className="mm-input text-sm"
          data-testid="quick-add-input"
        />
        <div className="mt-3 flex justify-between items-center">
          <div className="text-[11px] text-white/40">Powered by Gemini 3 Flash · ⌘ + Enter</div>
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="mm-btn-primary text-sm disabled:opacity-40"
            data-testid="quick-add-submit"
          >
            {loading ? "Parsing…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
