import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Filter, Upload } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Pending", "Done", "Follow-Up"];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    task: "",
    details: "",
    status: "Pending",
    date: "",
  });

  const load = async () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterName) params.name = filterName;
    const { data } = await api.get("/tasks", { params });
    setTasks(data);
  };

  useEffect(() => {
    load();
  }, [filterStatus, filterName]);

  const people = useMemo(() => Array.from(new Set(tasks.map((t) => t.name).filter(Boolean))), [tasks]);

  const insertOne = async (row) => {
    await api.post("/tasks", {
      task: row.task || "",
      name: row.name || "",
      details: row.details || "",
      status: row.status || "Pending",
      date: row.date || null,
    });
  };

  const create = async () => {
    if (!draft.task.trim()) return;
    try {
      const { data } = await api.post("/tasks", draft);
      setTasks((t) => [...t, data]);
      setDraft({ name: "", task: "", details: "", status: "Pending", date: "" });
      toast.success("Task added");
    } catch {
      toast.error("Failed");
    }
  };

  const patch = async (id, body) => {
    try {
      const { data } = await api.patch(`/tasks/${id}`, body);
      setTasks((t) => t.map((x) => (x.id === id ? data : x)));
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const describe = (r) =>
    `${r.name ? r.name + " · " : ""}${r.task || "(task)"}${
      r.date ? " · " + r.date : ""
    } · ${r.status || "Pending"}`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="tasks-page">
      <SectionTitle
        subtitle="Execution"
        title="Tasks"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip">
              {tasks.filter((t) => t.status === "Pending").length} pending
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

      {/* AI add bar */}
      <AiAddBar
        kind="task"
        placeholder="e.g. Remind Rahul to send invoice tomorrow"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-[#B7A98A]/65 text-xs uppercase tracking-[0.2em]">
          <Filter size={12} /> Filter
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="mm-input max-w-[180px] text-sm"
          data-testid="filter-status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="mm-input max-w-[220px] text-sm"
          data-testid="filter-person"
        >
          <option value="">All people</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {(filterStatus || filterName) && (
          <button
            onClick={() => {
              setFilterStatus("");
              setFilterName("");
            }}
            className="mm-btn-ghost text-xs"
          >
            Clear
          </button>
        )}
      </Card>

      {/* Manual add row */}
      <Card className="p-4" data-testid="task-add-row">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-task-date"
          />
          <input
            placeholder="Person"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-task-name"
          />
          <input
            placeholder="Task"
            value={draft.task}
            onChange={(e) => setDraft({ ...draft, task: e.target.value })}
            className="mm-input text-sm md:col-span-2"
            data-testid="new-task-input"
          />
          <input
            placeholder="Details"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
            className="mm-input text-sm md:col-span-2"
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="mm-input text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={create}
            disabled={!draft.task.trim()}
            className="mm-btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-40 md:col-span-7"
            data-testid="new-task-submit"
          >
            <Plus size={14} /> Add task
          </button>
        </div>
      </Card>

      {/* Table */}
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          hint="Type in the AI bar above, or fill the row, or paste a list via Bulk add."
        />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="tasks-table">
          <div className="hidden md:grid grid-cols-[60px_120px_160px_1.4fr_1fr_140px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.18)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60">
            <div>Sr</div>
            <div>Date</div>
            <div>Person</div>
            <div>Task</div>
            <div>Details</div>
            <div>Status</div>
            <div />
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-2 md:grid-cols-[60px_120px_160px_1.4fr_1fr_140px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] transition items-center"
              data-testid="task-row"
            >
              <div className="mm-text-gold/80 text-xs">#{t.sr_no}</div>
              <input
                type="date"
                value={t.date || ""}
                onChange={(e) => patch(t.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <input
                value={t.name || ""}
                onChange={(e) =>
                  setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={(e) => patch(t.id, { name: e.target.value })}
                placeholder="—"
                className="mm-input text-sm !py-1.5"
              />
              <input
                value={t.task}
                onChange={(e) =>
                  setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, task: e.target.value } : x)))
                }
                onBlur={(e) => patch(t.id, { task: e.target.value })}
                className="mm-input text-sm !py-1.5"
                data-testid="task-edit-title"
              />
              <input
                value={t.details || ""}
                onChange={(e) =>
                  setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, details: e.target.value } : x)))
                }
                onBlur={(e) => patch(t.id, { details: e.target.value })}
                placeholder="—"
                className="mm-input text-xs !py-1.5"
              />
              <select
                value={t.status}
                onChange={(e) => patch(t.id, { status: e.target.value })}
                className="mm-input text-xs !py-1.5"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => remove(t.id)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                data-testid="task-delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="task"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
