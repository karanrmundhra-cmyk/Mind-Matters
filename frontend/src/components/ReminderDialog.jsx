import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { X, BellRing } from "lucide-react";
import { toast } from "sonner";

const RECURRENCE_PRESETS = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Every Day" },
  { value: "weekly", label: "Every Week" },
  { value: "monthly", label: "Every Month" },
  { value: "quarterly", label: "Every 3 Months" },
  { value: "half-yearly", label: "Every 6 Months" },
  { value: "yearly", label: "Every Year" },
];

function nextHourIso() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * ReminderDialog — macOS-Reminders-style sheet for setting a reminder.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   defaults: { title?, notes?, fire_at?, recurrence?, source_page?, source_context? }
 *   onCreated?: (reminder) => void
 */
export default function ReminderDialog({ open, onClose, defaults = {}, onCreated }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [fireAt, setFireAt] = useState(nextHourIso());
  const [recurrence, setRecurrence] = useState("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaults.title || "");
      setNotes(defaults.notes || "");
      setFireAt(
        defaults.fire_at
          ? new Date(defaults.fire_at).toISOString().slice(0, 16)
          : nextHourIso(),
      );
      setRecurrence(defaults.recurrence || "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      const utc = new Date(fireAt).toISOString();
      const { data } = await api.post("/reminders", {
        title: title.trim(),
        notes: notes.trim(),
        fire_at: utc,
        recurrence,
        source_page: defaults.source_page || null,
        source_context: defaults.source_context || null,
      });
      toast.success("Reminder set");
      onCreated?.(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not set reminder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      data-testid="reminder-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-glass w-full max-w-md p-5 sm:p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BellRing size={16} className="mm-text-gold" />
            <div className="mm-font-display text-lg mm-text-gold-bright">Set Reminder</div>
          </div>
          <button onClick={onClose} className="text-[#B7A98A]/60 hover:text-[#E4C98C]" data-testid="reminder-dialog-close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mm-input text-sm"
              placeholder="Remind me to…"
              data-testid="reminder-dialog-title"
              autoFocus
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mm-input text-sm resize-none"
              placeholder="Optional details"
              rows={2}
              data-testid="reminder-dialog-notes"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">When</div>
            <input
              type="datetime-local"
              value={fireAt}
              onChange={(e) => setFireAt(e.target.value)}
              className="mm-input text-sm"
              data-testid="reminder-dialog-when"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">Recurrence</div>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="mm-input text-sm"
              data-testid="reminder-dialog-recurrence"
            >
              {RECURRENCE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="mm-btn-ghost text-sm"
            data-testid="reminder-dialog-cancel"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="mm-btn-primary text-sm disabled:opacity-40"
            data-testid="reminder-dialog-create"
          >
            {busy ? "Creating…" : "Create Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}
