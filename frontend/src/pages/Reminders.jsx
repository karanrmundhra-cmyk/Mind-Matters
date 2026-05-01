import React, { useEffect, useState } from "react";
import { api, BACKEND_URL } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { BellRing, Plus, Trash2, Download, Check, Clock, Upload } from "lucide-react";
import { toast } from "sonner";

const isoLocalNowPlusHour = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [tgLinked, setTgLinked] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    notes: "",
    fire_at_local: isoLocalNowPlusHour(),
    recurrence: "none",
  });

  const load = async () => {
    const [r, t] = await Promise.all([
      api.get("/reminders"),
      api.get("/telegram/status"),
    ]);
    setItems(r.data);
    setTgLinked(!!t.data.linked);
  };
  useEffect(() => {
    load();
  }, []);

  const toUTC = (local) => {
    if (!local) return null;
    const d = new Date(local); // interpreted as local time
    return d.toISOString();
  };
  const toLocal = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const create = async () => {
    if (!draft.title.trim() || !draft.fire_at_local) return;
    try {
      await api.post("/reminders", {
        title: draft.title,
        notes: draft.notes,
        fire_at: toUTC(draft.fire_at_local),
        recurrence: draft.recurrence,
      });
      setDraft({
        title: "",
        notes: "",
        fire_at_local: isoLocalNowPlusHour(),
        recurrence: "none",
      });
      await load();
      toast.success("Reminder set");
    } catch (e) {
      toast.error("Failed to save");
    }
  };

  const patch = async (id, body) => {
    await api.patch(`/reminders/${id}`, body);
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/reminders/${id}`);
    await load();
  };

  const downloadIcs = (id) => {
    const token = localStorage.getItem("mm_token");
    const url = `${BACKEND_URL}/api/reminders/${id}/ics`;
    // open with auth via fetch+blob (headers can't be set on href)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const u = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = u;
        a.download = "reminder.ics";
        a.click();
        URL.revokeObjectURL(u);
      });
  };

  const upcoming = items.filter((r) => !r.sent);
  const past = items.filter((r) => r.sent);

  const [bulkOpen, setBulkOpen] = useState(false);
  const insertOne = async (row) => {
    let fire_iso = row.fire_at;
    if (!fire_iso && row.fire_at_local) fire_iso = new Date(row.fire_at_local).toISOString();
    if (!fire_iso) return;
    await api.post("/reminders", {
      title: row.title || "Reminder",
      notes: row.notes || "",
      fire_at: fire_iso,
      recurrence: row.recurrence || "none",
    });
  };
  const describe = (r) =>
    `${r.title || "Reminder"} · ${r.fire_at_local || r.fire_at || ""} · ${r.recurrence || "none"}`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="reminders-page">
      <SectionTitle
        subtitle="Pings"
        title="Reminders & Alarms"
        right={
          <div className="flex items-center gap-2">
            <span
              className={`mm-chip ${tgLinked ? "mm-chip-gold" : ""}`}
              data-testid="tg-status-chip"
            >
              {tgLinked ? "Telegram linked" : "Link Telegram in Settings"}
            </span>
            <button
              onClick={() => setBulkOpen(true)}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="bulk-add-open"
            >
              <Upload size={12} /> Bulk add
            </button>
          </div>
        }
      />

      <AiAddBar
        kind="reminder"
        placeholder="e.g. Remind me to call Brinda every Monday at 9am"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <Card className="p-4" data-testid="reminder-add-row">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            placeholder="Reminder title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mm-input text-sm md:col-span-2"
            data-testid="new-reminder-title"
          />
          <input
            type="datetime-local"
            value={draft.fire_at_local}
            onChange={(e) => setDraft({ ...draft, fire_at_local: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-reminder-time"
          />
          <select
            value={draft.recurrence}
            onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}
            className="mm-input text-sm"
          >
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            placeholder="Notes (optional)"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="mm-input text-sm"
          />
          <button
            onClick={create}
            disabled={!draft.title.trim()}
            className="mm-btn-primary text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            data-testid="new-reminder-submit"
          >
            <Plus size={14} /> Set
          </button>
        </div>
        <div className="text-[11px] text-[#B7A98A]/55 mt-3 flex items-start gap-2">
          <BellRing size={11} className="mt-0.5" />
          <span>
            Reminders ping you on Telegram at the exact time. Tap the{" "}
            <Download size={10} className="inline" /> icon to add to iOS Calendar/Reminders.
          </span>
        </div>
      </Card>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No reminders yet"
          hint="Add the first one above. Link Telegram in Settings to receive pings."
        />
      ) : (
        <>
          <Card className="p-0 overflow-hidden" data-testid="reminders-upcoming">
            <div className="px-5 py-3 border-b border-[rgba(201,169,97,0.15)] text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 flex items-center gap-2">
              <Clock size={11} /> Upcoming
            </div>
            {upcoming.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[#B7A98A]/50">No upcoming reminders.</div>
            ) : (
              upcoming.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.1)] items-center"
                  data-testid="reminder-row"
                >
                  <div>
                    <input
                      defaultValue={r.title}
                      onBlur={(e) => patch(r.id, { title: e.target.value })}
                      className="bg-transparent outline-none text-sm mm-text-gold-bright font-medium"
                    />
                    {r.notes && (
                      <div className="text-xs text-[#B7A98A]/60 mt-1">{r.notes}</div>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={toLocal(r.fire_at)}
                    onChange={(e) => patch(r.id, { fire_at: toUTC(e.target.value) })}
                    className="mm-input text-xs !py-1.5 max-w-[200px]"
                  />
                  <button
                    onClick={() => downloadIcs(r.id)}
                    className="text-[#B7A98A]/70 hover:text-[#E4C98C] transition p-1"
                    title="Download .ics (add to iOS Calendar)"
                    data-testid="reminder-ics-btn"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-[#B7A98A]/70 hover:text-[#E4C98C] transition p-1"
                    data-testid="reminder-delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </Card>

          {past.length > 0 && (
            <Card className="p-0 overflow-hidden" data-testid="reminders-past">
              <div className="px-5 py-3 border-b border-[rgba(201,169,97,0.15)] text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 flex items-center gap-2">
                <Check size={11} /> Sent
              </div>
              {past.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] items-center opacity-60"
                >
                  <div className="text-sm">{r.title}</div>
                  <div className="text-xs text-[#B7A98A]/55">
                    {new Date(r.fire_at).toLocaleString()}
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="reminder"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
