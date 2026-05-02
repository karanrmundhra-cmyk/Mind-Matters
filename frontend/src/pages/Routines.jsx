import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Flame, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const BLOCKS = [
  { key: "block1", label: "4 Hours", index: 1 },
  { key: "block2", label: "8 Hours", index: 2 },
  { key: "block3", label: "4 Hours", index: 3 },
  { key: "block4", label: "8 Hours", index: 4 },
];

const FREQS = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

const ROUTINE_COLUMNS = [
  { key: "time_block", label: "Block", type: "select",
    options: ["block1", "block2", "block3", "block4"], width: "120px" },
  { key: "activity", label: "Activity", type: "text", width: "1.4fr" },
  { key: "details", label: "Details", type: "text", width: "1.4fr" },
  { key: "frequency", label: "Frequency", type: "select", options: FREQS, width: "120px" },
];

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    time_block: "block1",
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

  const insertOne = async (row) => {
    await api.post("/routines", {
      time_block: row.time_block || "block1",
      activity: capWords(row.activity || ""),
      details: capWords(row.details || ""),
      frequency: row.frequency || "Daily",
    });
  };

  const add = async () => {
    if (!draft.activity.trim()) return;
    try {
      await api.post("/routines", {
        ...draft,
        activity: capWords(draft.activity),
        details: capWords(draft.details),
      });
      setDraft({ time_block: draft.time_block, activity: "", details: "", frequency: "Daily" });
      await load();
      toast.success("Routine added to master");
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

  const groupedByBlock = BLOCKS.reduce((acc, b) => {
    acc[b.key] = routines.filter((r) => (r.time_block || "block1") === b.key);
    return acc;
  }, {});

  const describe = (r) =>
    `[${(BLOCKS.find((b) => b.key === r.time_block) || BLOCKS[0]).label}] ${r.activity}${
      r.details ? " — " + r.details : ""
    } · ${r.frequency || "Daily"}`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="routines-page">
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

      <div className="text-xs text-[#B7A98A]/55">
        The list below is your <span className="mm-text-gold-bright">master routine</span>.
        Ticks reset every day automatically — your master never disappears.
      </div>

      <AiAddBar
        kind="routine"
        placeholder="e.g. Morning walk 30 min in 4-hour block, daily"
        columns={ROUTINE_COLUMNS}
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <Card className="p-4" data-testid="routine-add-row">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={draft.time_block}
            onChange={(e) => setDraft({ ...draft, time_block: e.target.value })}
            className="mm-input text-sm"
          >
            {BLOCKS.map((b) => (
              <option key={b.key} value={b.key}>
                Block {b.index} · {b.label}
              </option>
            ))}
          </select>
          <input
            className="mm-input text-sm md:col-span-2"
            placeholder="Activity"
            value={draft.activity}
            onChange={(e) => setDraft({ ...draft, activity: e.target.value })}
            data-testid="new-routine-activity"
          />
          <input
            className="mm-input text-sm md:col-span-2"
            placeholder="Details (optional)"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
          />
          <select
            value={draft.frequency}
            onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
            className="mm-input text-sm"
          >
            {FREQS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!draft.activity.trim()}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 md:col-span-6"
            data-testid="new-routine-submit"
          >
            <Plus size={14} /> Add to master
          </button>
        </div>
      </Card>

      {routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          hint="Add to your daily master via AI or the row above. The daily checklist refreshes every day."
        />
      ) : (
        <div className="space-y-4">
          {BLOCKS.map((b) => {
            const items = groupedByBlock[b.key] || [];
            const blockKey = b.key;
            const totalThis = items.length;
            const doneThis = items.filter((r) => summary?.per_routine?.[r.id]?.done_today).length;
            const pct = totalThis ? Math.round((doneThis / totalThis) * 100) : 0;
            return (
              <Card key={blockKey} className="p-0 overflow-hidden" data-testid={`block-${blockKey}`}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(201,169,97,0.18)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(201,169,97,0.12)] border border-[rgba(201,169,97,0.35)] mm-text-gold-bright text-xs font-bold">
                      {b.index}
                    </div>
                    <div>
                      <div className="mm-font-display text-base mm-text-gold-bright">
                        {b.label}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55">
                        Block {b.index} · {totalThis} item{totalThis !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mm-text-gold">{pct}%</div>
                </div>

                {/* Header row */}
                <div className="hidden md:grid grid-cols-[40px_120px_1.6fr_1.6fr_120px_40px] gap-3 px-5 py-2 border-b border-[rgba(201,169,97,0.1)] text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/55">
                  <div />
                  <div>Hour</div>
                  <div>Task</div>
                  <div>Details</div>
                  <div>Frequency</div>
                  <div />
                </div>

                {items.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-[#B7A98A]/45">
                    No routines in this block yet.
                  </div>
                ) : (
                  items.map((r) => {
                    const info = summary?.per_routine?.[r.id];
                    const done = info?.done_today;
                    const streak = info?.streak || 0;
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-2 md:grid-cols-[40px_120px_1.6fr_1.6fr_120px_40px] gap-3 px-5 py-2.5 border-b border-[rgba(201,169,97,0.06)] hover:bg-[rgba(201,169,97,0.04)] items-center"
                        data-testid="routine-row"
                      >
                        <button
                          onClick={() => toggleToday(r.id, !done)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                            done
                              ? "bg-gradient-to-br from-[#E4C98C] to-[#C9A961] border-[#C9A961] text-black"
                              : "border-[rgba(201,169,97,0.35)] hover:border-[#E4C98C]"
                          }`}
                          data-testid="routine-tick"
                          aria-pressed={done}
                        >
                          {done && <Check size={12} strokeWidth={2.5} />}
                        </button>
                        <select
                          value={r.time_block || "block1"}
                          onChange={(e) => patch(r.id, { time_block: e.target.value })}
                          className="mm-input text-xs !py-1.5"
                        >
                          {BLOCKS.map((bb) => (
                            <option key={bb.key} value={bb.key}>
                              {bb.label}
                            </option>
                          ))}
                        </select>
                        <input
                          defaultValue={r.activity}
                          onBlur={(e) => patch(r.id, { activity: e.target.value })}
                          className="mm-input text-sm !py-1.5"
                        />
                        <input
                          defaultValue={r.details || ""}
                          onBlur={(e) => patch(r.id, { details: e.target.value })}
                          placeholder="—"
                          className="mm-input text-sm !py-1.5"
                        />
                        <select
                          value={r.frequency || "Daily"}
                          onChange={(e) => patch(r.id, { frequency: e.target.value })}
                          className="mm-input text-xs !py-1.5"
                        >
                          {FREQS.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 justify-self-end">
                          {streak > 0 && (
                            <div className="mm-chip mm-chip-gold flex items-center gap-1">
                              <Flame size={10} /> {streak}
                            </div>
                          )}
                          <button
                            onClick={() => remove(r.id)}
                            className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition"
                            data-testid="routine-delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="routine"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
