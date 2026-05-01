import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import { Plus, Trash2, Flame, Check } from "lucide-react";
import { toast } from "sonner";

const CATS = ["Health", "Social", "Spiritual", "Work", "Finance"];
const FREQS = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState({ category: "Health", activity: "", frequency: "Daily", priority: "Medium" });

  const load = async () => {
    const [r, s] = await Promise.all([api.get("/routines"), api.get("/routines/summary")]);
    setRoutines(r.data);
    setSummary(s.data);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!draft.activity.trim()) return;
    try {
      await api.post("/routines", draft);
      setDraft({ category: "Health", activity: "", frequency: "Daily", priority: "Medium" });
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

  const groupedByCat = CATS.reduce((acc, c) => {
    acc[c] = routines.filter((r) => r.category === c);
    return acc;
  }, {});

  return (
    <div className="space-y-6 mm-fade-in" data-testid="routines-page">
      <SectionTitle
        subtitle="Discipline"
        title="Routine Engine"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip" data-testid="routine-today-percent">
              {summary?.percent_today ?? 0}% today
            </span>
          </div>
        }
      />

      {/* Per-category summary bars */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CATS.map((c) => {
          const pct = summary?.category_percent?.[c] ?? 0;
          return (
            <Card key={c} className="p-4" data-testid={`category-card-${c}`}>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">{c}</div>
              <div className="mm-font-display text-2xl mt-1">{pct}%</div>
              <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white/70"
                  style={{ width: `${pct}%`, transition: "width 400ms ease" }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add */}
      <Card className="p-4" data-testid="routine-add-row">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="mm-input text-sm"
          >
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            className="mm-input text-sm md:col-span-2"
            placeholder="Activity (e.g., Morning walk 20 min)"
            value={draft.activity}
            onChange={(e) => setDraft({ ...draft, activity: e.target.value })}
            data-testid="new-routine-activity"
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
          <select
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            className="mm-input text-sm"
          >
            {["Low", "Medium", "High"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!draft.activity.trim()}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
            data-testid="new-routine-submit"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </Card>

      {/* List by category */}
      {routines.length === 0 ? (
        <EmptyState title="No routines yet" hint="Routines keep your discipline visible. Add one above." />
      ) : (
        <div className="space-y-4">
          {CATS.map((c) =>
            groupedByCat[c]?.length ? (
              <Card key={c} className="p-5" data-testid={`routine-group-${c}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60">
                    {c}
                  </div>
                  <div className="text-[10px] text-white/35">
                    {groupedByCat[c].length} routine{groupedByCat[c].length !== 1 ? "s" : ""}
                  </div>
                </div>
                <ul className="space-y-2">
                  {groupedByCat[c].map((r) => {
                    const info = summary?.per_routine?.[r.id];
                    const done = info?.done_today;
                    const streak = info?.streak || 0;
                    return (
                      <li
                        key={r.id}
                        className="group flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition"
                        data-testid="routine-row"
                      >
                        <button
                          onClick={() => toggleToday(r.id, !done)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                            done
                              ? "bg-white border-white text-black"
                              : "border-white/25 hover:border-white/60"
                          }`}
                          data-testid="routine-tick"
                          aria-pressed={done}
                        >
                          {done && <Check size={12} strokeWidth={2.5} />}
                        </button>
                        <input
                          value={r.activity}
                          onChange={(e) =>
                            setRoutines((s) =>
                              s.map((x) => (x.id === r.id ? { ...x, activity: e.target.value } : x))
                            )
                          }
                          onBlur={(e) => patch(r.id, { activity: e.target.value })}
                          className="flex-1 bg-transparent outline-none text-sm"
                        />
                        <div className="text-[10px] text-white/40 uppercase tracking-[0.2em]">
                          {r.frequency}
                        </div>
                        {streak > 0 && (
                          <div className="mm-chip flex items-center gap-1">
                            <Flame size={11} /> {streak}
                          </div>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white transition"
                          data-testid="routine-delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
