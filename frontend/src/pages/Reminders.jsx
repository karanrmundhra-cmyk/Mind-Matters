import React, { useEffect, useState } from "react";
import { api, BACKEND_URL } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import ExportButton from "@/components/ExportButton";
import AnchoredPanel from "@/components/AnchoredPanel";
import Calendar from "@/pages/Calendar";
import { BellRing, Plus, Trash2, Download, Check, Clock, Upload, RotateCcw, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectReload } from "@/lib/projects";

const REMINDER_COLUMNS = [
  { key: "title", label: "Title", type: "text", width: "1.4fr" },
  { key: "fire_at_local", label: "When", type: "text", width: "200px" },
  { key: "recurrence", label: "Recurrence", type: "select",
    options: ["none", "daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly"], width: "140px" },
  { key: "notes", label: "Notes", type: "text", width: "1fr" },
];

const isoLocalNowPlusHour = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const SOURCE_LABEL = {
  tasks: "From Tasks",
  routines: "From Routines",
  "cash-flow": "From Cash Flow",
  cashflow: "From Cash Flow",
  notes: "From Notes",
  reminders: "Standalone",
};

function renderGroupedUpcoming(upcoming, helpers) {
  // Group by source_page; "standalone" bucket for reminders without a source.
  const groups = {};
  for (const r of upcoming) {
    const key = r.source_page || "standalone";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const ordered = ["tasks", "routines", "cash-flow", "cashflow", "notes", "standalone"]
    .filter((k) => groups[k] && groups[k].length)
    .concat(Object.keys(groups).filter(
      (k) => !["tasks", "routines", "cash-flow", "cashflow", "notes", "standalone"].includes(k),
    ));

  return ordered.map((key) => (
    <div key={key} data-testid={`reminder-group-${key}`}>
      <div className="px-4 py-1.5 bg-[rgba(201,169,97,0.04)] border-b border-[rgba(201,169,97,0.1)] text-[10px] uppercase tracking-[0.3em] mm-text-gold min-w-[760px] md:min-w-0">
        {SOURCE_LABEL[key] || `From ${key}`} <span className="text-[#B7A98A]/50">· {groups[key].length}</span>
      </div>
      {groups[key].map((r) => (
        <UpcomingRow key={r.id} r={r} {...helpers} />
      ))}
    </div>
  ));
}

function UpcomingRow({ r, patch, remove, downloadIcs, toLocal, toUTC }) {
  const srcLabel = SOURCE_LABEL[r.source_page] || (r.source_page ? `From ${r.source_page}` : "");
  return (
    <div
      className="px-4 py-2 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.03)] transition min-w-[760px] md:min-w-0"
      data-testid="reminder-row"
    >
      <div className="grid grid-cols-[40px_1.4fr_180px_120px_1fr_80px_28px_28px] gap-2 items-center">
        <div className="mm-text-gold/55 text-[11px] mm-frozen-col text-center">
          {srcLabel ? "·" : "#"}
        </div>
        <input
          defaultValue={r.title}
          onBlur={(e) => patch(r.id, { title: e.target.value })}
          className="mm-input-ghost text-sm"
        />
        <input
          type="datetime-local"
          defaultValue={toLocal(r.fire_at)}
          onBlur={(e) => patch(r.id, { fire_at: toUTC(e.target.value) })}
          className="mm-input-ghost text-xs"
        />
        <select
          defaultValue={r.recurrence || "none"}
          onChange={(e) => patch(r.id, { recurrence: e.target.value })}
          className="mm-input-ghost text-xs"
        >
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="half-yearly">Half-Yearly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          defaultValue={r.notes || ""}
          onBlur={(e) => patch(r.id, { notes: e.target.value })}
          placeholder="Notes"
          className="mm-input-ghost text-xs"
        />
        {srcLabel ? (
          <span
            className="text-[9px] uppercase tracking-[0.15em] px-1.5 py-1 rounded border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.04)] mm-text-gold/85 text-center truncate"
            data-testid="reminder-source-badge"
            title={`Linked to ${srcLabel}`}
          >
            {srcLabel.replace("From ", "")}
          </span>
        ) : <span className="text-[9px] uppercase tracking-[0.15em] text-[#B7A98A]/40 text-center">—</span>}
        <button
          onClick={() => downloadIcs(r.id)}
          className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition p-1"
          title="Download .ics"
          data-testid="reminder-download-ics"
        >
          <Download size={14} />
        </button>
        <button
          onClick={() => remove(r.id)}
          className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1"
          data-testid="reminder-delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

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
  useProjectReload(load);

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

  const resend = async (id, fireAtIso) => {
    try {
      await api.post(`/reminders/${id}/resend`, fireAtIso ? { fire_at: fireAtIso } : {});
      await load();
      toast.success(fireAtIso ? "Re-scheduled for chosen date" : "Re-scheduled");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not resend");
    }
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
  const [activeTab, setActiveTab] = useState("reminders"); // calendar | reminders
  // Inline date-picker popover state for "Repeat at chosen date" on a Sent reminder.
  const [rescheduleFor, setRescheduleFor] = useState(null); // { id, anchor, fire_at_local }
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
              <Upload size={12} /> Import
            </button>
            <ExportButton module="reminders" />
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        Timely nudges straight to your phone.
      </p>

      {/* Calendar | Reminders tab bar */}
      <div className="flex items-center gap-1 border-b border-[rgba(201,169,97,0.12)]">
        {[
          { id: "calendar", label: "Calendar" },
          { id: "reminders", label: "Reminders" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-[0.2em] transition border-b-2 -mb-px ${
              activeTab === t.id
                ? "mm-text-gold-bright border-[#C9A961]"
                : "text-[#B7A98A]/55 border-transparent hover:text-[#E4C98C]"
            }`}
            data-testid={`reminders-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            const url = `${BACKEND_URL}/api/calendar/feed.ics?token=${
              encodeURIComponent(localStorage.getItem("mm_token") || "")
            }`;
            navigator.clipboard?.writeText(url);
            toast.success("iCal feed URL copied. Subscribe in Google/iCloud/Outlook calendar.");
          }}
          className="ml-auto mm-btn-ghost text-xs flex items-center gap-1.5"
          data-testid="reminders-sync-ical"
          title="Generate iCal subscription URL for Google / iCloud / Outlook"
        >
          <Link2 size={12} /> Sync (iCal)
        </button>
      </div>

      {activeTab === "calendar" ? (
        <Calendar />
      ) : (
        <>
          <AiAddBar
            kind="reminder"
            placeholder="e.g. Remind me to call Brinda every Monday at 9am"
            columns={REMINDER_COLUMNS}
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
            <option value="quarterly">Quarterly</option>
            <option value="half-yearly">Half-Yearly</option>
            <option value="yearly">Yearly</option>
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
            <div className="mm-table-wrap overflow-x-auto md:overflow-visible">
            {/* Column headers — match Tasks/Routines compact style */}
            <div
              className="grid grid-cols-[40px_1.4fr_180px_120px_1fr_80px_28px_28px] gap-2 items-center px-4 py-2 border-b border-[rgba(201,169,97,0.2)] min-w-[760px] md:min-w-0"
              data-testid="reminders-table-header"
            >
              <div className="mm-frozen-col text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70 text-center">
                #
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70">Title</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70">When</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70">Recurrence</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70">Notes</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#B7A98A]/70 text-center">Source</div>
              <div />
              <div />
            </div>
            {upcoming.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[#B7A98A]/50">No upcoming reminders.</div>
            ) : (
              renderGroupedUpcoming(upcoming, { patch, remove, downloadIcs, toLocal, toUTC })
            )}
            </div>
          </Card>

          {past.length > 0 && (
            <Card className="p-0 overflow-hidden" data-testid="reminders-past">
              <div className="px-5 py-3 border-b border-[rgba(201,169,97,0.15)] text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 flex items-center gap-2">
                <Check size={11} /> Sent
              </div>
              {past.slice(0, 20).map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] items-center opacity-70"
                  data-testid="reminder-past-row"
                >
                  <div className="text-sm">
                    {r.title}
                    {r.recurrence && r.recurrence !== "none" && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/50">
                        · {r.recurrence}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#B7A98A]/55">
                    {new Date(r.fire_at).toLocaleString()}
                  </div>
                  <button
                    onClick={(e) => {
                      const base = new Date(Math.max(Date.now(), new Date(r.fire_at).getTime() || 0) + 24 * 60 * 60 * 1000);
                      const pad = (n) => String(n).padStart(2, "0");
                      const local = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
                      setRescheduleFor({
                        id: r.id,
                        anchor: e.currentTarget,
                        fire_at_local: local,
                        title: r.title,
                      });
                    }}
                    className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition p-1"
                    title="Repeat — pick a new date & time"
                    data-testid="reminder-resend"
                  >
                    <RotateCcw size={14} />
                  </button>
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

      <AnchoredPanel
        open={!!rescheduleFor}
        anchor={rescheduleFor?.anchor}
        onClose={() => setRescheduleFor(null)}
        width={340}
        maxHeight="auto"
        testId="reminder-reschedule-popover"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">Repeat reminder</div>
              <div className="mm-font-display text-sm mm-text-gold-bright mt-0.5 truncate max-w-[260px]">
                {rescheduleFor?.title || "Reminder"}
              </div>
            </div>
            <button
              onClick={() => setRescheduleFor(null)}
              className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition"
              data-testid="reminder-reschedule-close"
            >
              ✕
            </button>
          </div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mb-1.5">
            New date &amp; time
          </label>
          <input
            type="datetime-local"
            value={rescheduleFor?.fire_at_local || ""}
            onChange={(e) =>
              setRescheduleFor((p) => (p ? { ...p, fire_at_local: e.target.value } : p))
            }
            className="mm-input text-sm w-full"
            data-testid="reminder-reschedule-when"
          />
          <p className="text-[10px] text-[#B7A98A]/50 mt-2">
            Re-schedules this reminder for the chosen date — fires once, then sits in Upcoming.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setRescheduleFor(null)}
              className="mm-btn-ghost text-xs"
              data-testid="reminder-reschedule-cancel"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!rescheduleFor) return;
                const iso = toUTC(rescheduleFor.fire_at_local);
                if (!iso) {
                  toast.error("Pick a date & time first");
                  return;
                }
                const id = rescheduleFor.id;
                setRescheduleFor(null);
                await resend(id, iso);
              }}
              className="mm-btn-primary text-xs flex items-center gap-1.5"
              data-testid="reminder-reschedule-confirm"
            >
              <Check size={12} /> Repeat at chosen date
            </button>
          </div>
        </div>
      </AnchoredPanel>
    </div>
  );
}
