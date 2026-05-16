import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { X, BellRing, Check } from "lucide-react";
import { toast } from "sonner";
import AnchoredPanel from "@/components/AnchoredPanel";

const RECURRENCE_PRESETS = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Every 2 Months" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
];

function nextHourIso() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ReminderDialog({ open, onClose, defaults = {}, onCreated, anchor }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [fireAt, setFireAt] = useState(nextHourIso());
  const [whenSet, setWhenSet] = useState(false);
  const [recurrence, setRecurrence] = useState("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaults.title || "");
      setNotes(defaults.notes || "");
      const initial = defaults.fire_at
        ? new Date(defaults.fire_at).toISOString().slice(0, 16)
        : nextHourIso();
      setFireAt(initial);
      setWhenSet(false);
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
      const payload = {
        title: title.trim(),
        notes: notes.trim(),
        fire_at: utc,
        recurrence,
        source_page: defaults.source_page || null,
        source_context: defaults.source_context || null,
      };
      const { data } = await api.post("/reminders", payload);
      toast.success("Reminder set");
      onCreated?.(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not set reminder");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="p-5 sm:p-6">
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
          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input
              type="datetime-local"
              value={fireAt}
              onChange={(e) => {
                setFireAt(e.target.value);
                setWhenSet(false);
              }}
              className="mm-input text-sm flex-1"
              data-testid="reminder-dialog-when"
            />
            <button
              type="button"
              onClick={() => setWhenSet(true)}
              className={`text-xs px-4 py-2 rounded-lg font-medium tracking-wide border transition flex items-center justify-center gap-1.5 shrink-0 ${
                whenSet
                  ? "border-[#C9A961] bg-gradient-to-r from-[#E4C98C] to-[#C9A961] text-black"
                  : "border-[#C9A961] bg-[rgba(201,169,97,0.1)] mm-text-gold-bright hover:bg-[rgba(201,169,97,0.2)]"
              }`}
              data-testid="reminder-dialog-when-set"
              title="Confirm this time"
            >
              <Check size={13} strokeWidth={2.5} /> {whenSet ? "Time set" : "Set time"}
            </button>
          </div>
          {whenSet ? (
            <div className="text-[10px] mm-text-gold-bright mt-2 uppercase tracking-[0.2em]">
              ✓ Scheduled for {fmtWhen(fireAt)}
            </div>
          ) : (
            <div className="text-[10px] text-[#B7A98A]/55 mt-2">
              Pick a date & time, then tap <span className="mm-text-gold-bright">Set time</span> to confirm.
            </div>
          )}
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
          {busy ? "Setting…" : "Set Reminder"}
        </button>
      </div>
    </div>
  );

  if (anchor) {
    return (
      <AnchoredPanel
        anchor={anchor}
        open={open}
        onClose={onClose}
        width={420}
        maxHeight="78vh"
        testId="reminder-dialog"
      >
        <div className="overflow-y-auto">{body}</div>
      </AnchoredPanel>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      data-testid="reminder-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-glass w-full max-w-md rounded-2xl"
      >
        {body}
      </div>
    </div>
  );
}
