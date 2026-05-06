import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const KINDS = [
  { value: "task", label: "Task" },
  { value: "routine", label: "Routine" },
  { value: "expense", label: "Expense" },
  { value: "note", label: "Note" },
  { value: "reminder", label: "Reminder" },
];

const PLACEHOLDER = {
  task: "Remind Rahul to send invoice tomorrow",
  routine: "Morning walk at park daily, self",
  expense: "Insurance from Bajaj for Karan 5 lakhs",
  note: "Add milk to shopping list",
  reminder: "Call dad every Sunday at 9am",
};

export default function QuickAdd({ open, onClose, defaultKind = "task" }) {
  const [kind, setKind] = useState(defaultKind);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const msg = text.trim();
    if (!msg) return;
    setLoading(true);
    try {
      // Use the bulk parser for richer schemas (group, vendor, recurrence, list-append, etc.)
      const { data } = await api.post("/parse/bulk", { kind, text: msg });
      const rows = data.rows || [];
      if (!rows.length) {
        toast.error("Could not parse — try rephrasing.");
        return;
      }

      for (const r of rows) {
        if (kind === "task") {
          const created = await api.post("/tasks", {
            task: r.task || msg,
            name: r.name || "",
            details: r.details || "",
            date: r.date || null,
            status: r.status || "Pending",
            group: r.group || "",
          });
          if (r.reminder_at) {
            try {
              await api.post("/reminders", {
                title: r.task ? `${r.task}${r.name ? " — " + r.name : ""}` : "Task",
                notes: [r.name && `To: ${r.name}`, r.details].filter(Boolean).join(" — "),
                fire_at: new Date(r.reminder_at).toISOString(),
                recurrence: "none",
                source_page: "tasks",
                source_context: created?.data || {},
              });
            } catch { /* non-fatal */ }
          }
        } else if (kind === "routine") {
          await api.post("/routines", {
            group: r.group || "",
            name: r.name || "",
            activity: r.activity || msg,
            details: r.details || "",
            frequency: r.frequency || "Daily",
          });
        } else if (kind === "expense") {
          const cat = (r.category || "expense").toLowerCase();
          const vendor = r.vendor || r.company || "";
          const personName = r.name && r.name !== vendor ? r.name : vendor;
          const mode = r.mode || "Bank";
          const head = r.head || r.expense_head || "";
          const details = r.details || r.notes || "";
          await api.post("/transactions", {
            amount: Math.abs(Number(r.amount) || 0),
            date: r.date || null,
            mode, vendor, name: personName, company: vendor,
            details, notes: details, head, expense_head: head,
            category: cat, group: r.group || "",
            remarks: mode,
            direction: cat === "income" || cat === "asset" ? "in" : "out",
          });
        } else if (kind === "note") {
          const items = Array.isArray(r.items) ? r.items
                      : (typeof r.items === "string" ? [r.items] : null);
          if ((r.list_title || r.list_tag) && items?.length) {
            await api.post("/notes/append-list", {
              title_hint: r.list_title || null,
              tag: r.list_tag || null,
              items, create_if_missing: true,
            });
          } else {
            await api.post("/notes", {
              title: r.title || msg.slice(0, 40),
              body: r.body || msg,
              tags: r.tags || [],
            });
          }
        } else if (kind === "reminder") {
          let fire_iso = r.fire_at;
          if (!fire_iso && r.fire_at_local) fire_iso = new Date(r.fire_at_local).toISOString();
          if (fire_iso) {
            await api.post("/reminders", {
              title: r.title || msg,
              notes: r.notes || "",
              fire_at: fire_iso,
              recurrence: r.recurrence || "none",
            });
          }
        }
      }
      toast.success(`${KINDS.find((k) => k.value === kind)?.label || "Item"} added`);
      setText("");
      onClose();
    } catch {
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

        <div className="flex flex-wrap gap-2 mb-3">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKind(k.value)}
              data-testid={`quick-add-kind-${k.value}`}
              className={`px-3 py-1.5 rounded-full text-xs transition ${
                kind === k.value
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/70 hover:bg-white/5"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.metaKey && submit()}
          placeholder={PLACEHOLDER[kind]}
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
