import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import { useReorder } from "@/lib/useReorder";
import { Plus, Flame, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const DEFAULT_FREQS = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

const ROUTINE_COLUMNS = [
  { key: "group", label: "Group", type: "text", width: "140px" },
  { key: "activity", label: "Task", type: "text", width: "1.3fr" },
  { key: "details", label: "Details", type: "text", width: "1.3fr" },
  { key: "frequency", label: "Frequency", type: "text", width: "140px" },
];

const GRID = "grid-cols-[50px_140px_1.2fr_1.2fr_140px_150px]";

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeGroup, setActiveGroup] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    group: "",
    activity: "",
    details: "",
    frequency: "Daily",
  });

  const load = async () => {
    const [r, s] = await Promise.all([api.get("/routines"), api.get("/routines/summary")]);
    setRoutines(r.data);
    setSummary(s.data);
  };
  useEffect(() => {
    load();
  }, []);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("routines", routines, setRoutines);

  const groups = useMemo(
    () => Array.from(new Set(routines.map((r) => r.group).filter(Boolean))).sort(),
    [routines],
  );
  const freqs = useMemo(
    () => Array.from(new Set([...DEFAULT_FREQS, ...routines.map((r) => r.frequency).filter(Boolean)])),
    [routines],
  );
  const visible = useMemo(
    () => routines.filter((r) => !activeGroup || r.group === activeGroup),
    [routines, activeGroup],
  );

  const insertOne = async (row) => {
    await api.post("/routines", {
      group: capWords(row.group || activeGroup || "General"),
      activity: capWords(row.activity || ""),
      details: capWords(row.details || ""),
      frequency: row.frequency || "Daily",
    });
  };

  const add = async () => {
    if (!draft.activity.trim()) return;
    try {
      await insertOne(draft);
      setDraft({ group: draft.group, activity: "", details: "", frequency: draft.frequency });
      await load();
      toast.success("Routine added");
    } catch {
      toast.error("Failed");
    }
  };

  const toggleToday = async (rid, done) => {
    await api.post("/routine-logs", { routine_id: rid, done });
    await load();
  };

  const patch = async (id, body) => {
    await api.patch(`/routines/${id}`, body);
    await load();
  };
  const remove = async (id) => {
    await api.delete(`/routines/${id}`);
    await load();
  };

  const addAsReminder = async (r) => {
    try {
      const base = new Date(Date.now() + 60 * 60 * 1000);
      await api.post("/reminders", {
        title: r.activity || "Routine",
        notes: [r.group && `Group: ${r.group}`, r.details, `Frequency: ${r.frequency}`]
          .filter(Boolean)
          .join(" — "),
        fire_at: base.toISOString(),
        recurrence: (r.frequency || "").toLowerCase().includes("daily") ? "daily" : "none",
        source_page: "routines",
        source_context: { group: r.group, activity: r.activity, details: r.details, frequency: r.frequency },
      });
      toast.success("Reminder created");
    } catch {
      toast.error("Reminder failed");
    }
  };

  const newGroupPrompt = () => {
    const g = window.prompt("New group name (e.g. Morning, 4-Hour Focus, Evening)?", "");
    if (g && g.trim()) setActiveGroup(g.trim());
  };

  return (
    <div className="space-y-5 mm-fade-in" data-testid="routines-page">
      <SectionTitle
        subtitle="Discipline"
        title="Routine Engine"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip mm-chip-gold" data-testid="routine-today-percent">
              {summary?.percent_today ?? 0}% today
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
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        Your daily rituals — the master list never disappears, the ticks reset every morning.
      </p>

      <AiAddBar
        kind="routine"
        placeholder="e.g. Morning walk 30 min, group Morning, daily"
        columns={ROUTINE_COLUMNS}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <GroupTabs
        groups={groups}
        active={activeGroup}
        onChange={setActiveGroup}
        onAdd={newGroupPrompt}
      />

      <Card className="p-0 overflow-hidden" data-testid="routines-table">
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60`}>
          <div>Sr</div>
          <div>Group</div>
          <div>Task</div>
          <div>Details</div>
          <div>Frequency</div>
          <div />
        </div>

        {/* Manual entry bar BELOW headers */}
        <div
          className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center`}
          data-testid="routine-add-row"
        >
          <div className="mm-text-gold/60 text-xs">#new</div>
          <input
            list="routine-groups"
            placeholder={activeGroup || "Group"}
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            className="mm-input text-xs !py-1.5"
            data-testid="new-routine-group"
          />
          <input
            className="mm-input text-xs !py-1.5"
            placeholder="Task / activity"
            value={draft.activity}
            onChange={(e) => setDraft({ ...draft, activity: e.target.value })}
            data-testid="new-routine-activity"
          />
          <input
            className="mm-input text-xs !py-1.5"
            placeholder="Details"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
          />
          <input
            list="routine-freqs"
            value={draft.frequency}
            onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
            className="mm-input text-xs !py-1.5"
            placeholder="Daily / custom"
          />
          <button
            onClick={add}
            disabled={!draft.activity.trim()}
            className="mm-btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 !py-1.5"
            data-testid="new-routine-submit"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={activeGroup ? `No routines in "${activeGroup}"` : "No routines yet"}
            hint="Add to your daily master via AI, the row above, or Bulk add."
          />
        ) : (
          visible.map((r, idx) => {
            const info = summary?.per_routine?.[r.id];
            const done = info?.done_today;
            const streak = info?.streak || 0;
            return (
              <div
                key={r.id}
                className={`grid grid-cols-2 md:${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center ${
                  draggingId === r.id ? "opacity-40" : ""
                }`}
                data-testid="routine-row"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleToday(r.id, !done)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      done
                        ? "bg-gradient-to-br from-[#E4C98C] to-[#C9A961] border-[#C9A961] text-black"
                        : "border-[rgba(201,169,97,0.35)] hover:border-[#E4C98C]"
                    }`}
                    data-testid="routine-tick"
                  >
                    {done && <Check size={12} strokeWidth={2.5} />}
                  </button>
                  <span className="mm-text-gold/70 text-xs">#{r.sr_no || idx + 1}</span>
                </div>
                <input
                  list="routine-groups"
                  defaultValue={r.group || ""}
                  onBlur={(e) => patch(r.id, { group: capWords(e.target.value) })}
                  placeholder="—"
                  className="mm-input text-xs !py-1.5"
                />
                <input
                  defaultValue={r.activity}
                  onBlur={(e) => patch(r.id, { activity: capWords(e.target.value) })}
                  className="mm-input text-xs !py-1.5"
                />
                <input
                  defaultValue={r.details || ""}
                  onBlur={(e) => patch(r.id, { details: capWords(e.target.value) })}
                  placeholder="—"
                  className="mm-input text-xs !py-1.5"
                />
                <input
                  list="routine-freqs"
                  defaultValue={r.frequency || "Daily"}
                  onBlur={(e) => patch(r.id, { frequency: e.target.value })}
                  className="mm-input text-xs !py-1.5"
                />
                <div className="flex items-center gap-1">
                  {streak > 0 && (
                    <div className="mm-chip mm-chip-gold flex items-center gap-1 text-[10px]">
                      <Flame size={9} /> {streak}
                    </div>
                  )}
                  <RowActions
                    kind="routine"
                    rowId={r.id}
                    draggable
                    onDragStart={onDragStart(r.id)}
                    onDragOver={onDragOver(r.id)}
                    onDrop={onDrop(r.id)}
                    onDragEnd={onDragEnd}
                    onUp={idx > 0 ? () => move(r.id, -1) : undefined}
                    onDown={idx < visible.length - 1 ? () => move(r.id, 1) : undefined}
                    onReminder={() => addAsReminder(r)}
                    onDelete={() => remove(r.id)}
                  />
                </div>
              </div>
            );
          })
        )}
      </Card>

      <datalist id="routine-groups">
        {groups.map((g) => <option key={g} value={g} />)}
      </datalist>
      <datalist id="routine-freqs">
        {freqs.map((f) => <option key={f} value={f} />)}
      </datalist>

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="routine"
        describe={(r) => `[${r.group || "General"}] ${r.activity} · ${r.frequency || "Daily"}`}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
