import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import { Plus, Trash2, Filter, Check, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Pending", "Done", "Follow-Up"];
const StatusIcon = ({ s }) =>
  s === "Done" ? <Check size={12} /> : s === "Follow-Up" ? <RotateCcw size={12} /> : <Clock size={12} />;

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [loading, setLoading] = useState(true);

  const [newTask, setNewTask] = useState({ name: "", task: "", details: "", status: "Pending", date: "" });

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterName) params.name = filterName;
    const { data } = await api.get("/tasks", { params });
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [filterStatus, filterName]);

  const people = useMemo(() => {
    const s = new Set(tasks.map((t) => t.name).filter(Boolean));
    return Array.from(s);
  }, [tasks]);

  const create = async () => {
    if (!newTask.task.trim()) return;
    try {
      const { data } = await api.post("/tasks", newTask);
      setTasks((t) => [...t, data]);
      setNewTask({ name: "", task: "", details: "", status: "Pending", date: "" });
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
      setTasks((t) => t.filter((x) => x.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="tasks-page">
      <SectionTitle
        subtitle="Execution"
        title="Tasks"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip">{tasks.filter((t) => t.status === "Pending").length} pending</span>
          </div>
        }
      />

      {/* Filter bar */}
      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-[0.2em]">
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
            data-testid="filter-clear"
          >
            Clear
          </button>
        )}
      </Card>

      {/* Add row */}
      <Card className="p-4" data-testid="task-add-row">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
          <input
            placeholder="Task"
            value={newTask.task}
            onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
            className="mm-input text-sm md:col-span-2"
            data-testid="new-task-input"
          />
          <input
            placeholder="Person"
            value={newTask.name}
            onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-task-name"
          />
          <input
            type="date"
            value={newTask.date}
            onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-task-date"
          />
          <input
            placeholder="Details"
            value={newTask.details}
            onChange={(e) => setNewTask({ ...newTask, details: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-task-details"
          />
          <button
            onClick={create}
            disabled={!newTask.task.trim()}
            className="mm-btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-40"
            data-testid="new-task-submit"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" hint="Add tasks above — or use Quick add on the dashboard to create them with natural language." />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="tasks-table">
          <div className="hidden md:grid grid-cols-[60px_120px_1fr_160px_1fr_140px_40px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <div>Sr</div>
            <div>Date</div>
            <div>Task</div>
            <div>Person</div>
            <div>Details</div>
            <div>Status</div>
            <div />
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-2 md:grid-cols-[60px_120px_1fr_160px_1fr_140px_40px] gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition items-center"
              data-testid="task-row"
            >
              <div className="text-white/40 text-xs">#{t.sr_no}</div>
              <input
                type="date"
                value={t.date || ""}
                onChange={(e) => patch(t.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <input
                value={t.task}
                onChange={(e) => setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, task: e.target.value } : x)))}
                onBlur={(e) => patch(t.id, { task: e.target.value })}
                className="mm-input text-sm !py-1.5"
                data-testid="task-edit-title"
              />
              <input
                value={t.name || ""}
                onChange={(e) => setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                onBlur={(e) => patch(t.id, { name: e.target.value })}
                placeholder="—"
                className="mm-input text-sm !py-1.5"
              />
              <input
                value={t.details || ""}
                onChange={(e) => setTasks((s) => s.map((x) => (x.id === t.id ? { ...x, details: e.target.value } : x)))}
                onBlur={(e) => patch(t.id, { details: e.target.value })}
                placeholder="—"
                className="mm-input text-xs !py-1.5"
              />
              <select
                value={t.status}
                onChange={(e) => patch(t.id, { status: e.target.value })}
                className="mm-input text-xs !py-1.5"
                data-testid="task-status-select"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => remove(t.id)}
                className="text-white/40 hover:text-white transition justify-self-end"
                data-testid="task-delete"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
