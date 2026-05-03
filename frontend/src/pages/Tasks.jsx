import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import { useReorder } from "@/lib/useReorder";
import { Plus, Filter, Upload } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const STATUSES = ["Pending", "Done", "Follow-Up"];

const TASK_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "120px" },
  { key: "group", label: "Group", type: "text", width: "120px" },
  { key: "name", label: "To", type: "text", width: "140px" },
  { key: "task", label: "Task", type: "text", width: "1.2fr" },
  { key: "details", label: "Details", type: "text", width: "1fr" },
  { key: "status", label: "Status", type: "select", options: STATUSES, width: "120px" },
];

const GRID =
  "grid-cols-[50px_110px_110px_140px_1.1fr_1fr_110px_140px]";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({ status: "", name: "", date: "" });
  const [activeGroup, setActiveGroup] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    date: "",
    group: "",
    name: "",
    task: "",
    details: "",
    status: "Pending",
  });

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(data);
  };
  useEffect(() => {
    load();
  }, []);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("tasks", tasks, setTasks);

  const groups = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.group).filter(Boolean))).sort(),
    [tasks],
  );
  const people = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.name).filter(Boolean))),
    [tasks],
  );

  // Apply filters client-side
  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (activeGroup && t.group !== activeGroup) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.name && t.name !== filter.name) return false;
      if (filter.date && t.date !== filter.date) return false;
      return true;
    });
  }, [tasks, activeGroup, filter]);

  const pendingCount = tasks.filter((t) => t.status === "Pending").length;

  const insertOne = async (row) => {
    await api.post("/tasks", {
      date: row.date || null,
      group: capWords(row.group || activeGroup || ""),
      name: capWords(row.name || ""),
      task: capWords(row.task || ""),
      details: capWords(row.details || ""),
      status: row.status || "Pending",
    });
  };

  const create = async () => {
    if (!draft.task.trim()) return;
    try {
      await insertOne({ ...draft, group: draft.group || activeGroup });
      setDraft({ date: "", group: draft.group, name: "", task: "", details: "", status: "Pending" });
      await load();
      toast.success("Task added");
    } catch {
      toast.error("Failed");
    }
  };

  const patch = async (id, body) => {
    try {
      await api.patch(`/tasks/${id}`, body);
      await load();
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (id) => {
    await api.delete(`/tasks/${id}`);
    await load();
  };

  const addAsReminder = async (t) => {
    try {
      const base = t.date ? new Date(t.date + "T09:00:00") : new Date(Date.now() + 24 * 3600 * 1000);
      if (!t.date) base.setHours(9, 0, 0, 0);
      await api.post("/reminders", {
        title: t.task || "Task",
        notes: [t.name && `To: ${t.name}`, t.details].filter(Boolean).join(" — "),
        fire_at: base.toISOString(),
        recurrence: "none",
        source_page: "tasks",
        source_context: {
          sr_no: t.sr_no, date: t.date, group: t.group, to: t.name,
          task: t.task, details: t.details, status: t.status,
        },
      });
      toast.success("Reminder created");
    } catch {
      toast.error("Reminder failed");
    }
  };

  const newGroupPrompt = () => {
    const g = window.prompt("New group name (e.g. Personal, Work, Brinda)?", "");
    if (g && g.trim()) setActiveGroup(g.trim());
  };

  return (
    <div className="space-y-5 mm-fade-in" data-testid="tasks-page">
      <SectionTitle
        subtitle="Execution"
        title="Tasks"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip" data-testid="tasks-status-chip">
              {pendingCount} pending
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
        Capture every commitment — by person, by group, by due date. Tick them off as you go.
      </p>

      {/* AI add bar */}
      <AiAddBar
        kind="task"
        placeholder="e.g. Remind Rahul to send invoice tomorrow · Group: Work"
        columns={TASK_COLUMNS}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      {/* Filters */}
      <Card className="p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="flex items-center gap-2 text-[#B7A98A]/65 text-xs uppercase tracking-[0.2em]">
          <Filter size={12} /> Filter
        </div>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="mm-input max-w-[160px] text-sm"
          data-testid="filter-status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filter.name}
          onChange={(e) => setFilter({ ...filter, name: e.target.value })}
          className="mm-input max-w-[180px] text-sm"
          data-testid="filter-person"
        >
          <option value="">All people</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
        <input
          type="date"
          value={filter.date}
          onChange={(e) => setFilter({ ...filter, date: e.target.value })}
          className="mm-input max-w-[160px] text-sm"
          data-testid="filter-date"
        />
        {(filter.status || filter.name || filter.date) && (
          <button
            onClick={() => setFilter({ status: "", name: "", date: "" })}
            className="mm-btn-ghost text-xs"
          >
            Clear
          </button>
        )}
      </Card>

      {/* Group tabs */}
      <GroupTabs
        groups={groups}
        active={activeGroup}
        onChange={setActiveGroup}
        onAdd={newGroupPrompt}
      />

      {/* Table */}
      <Card className="p-0 overflow-hidden" data-testid="tasks-table">
        {/* Headers */}
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60`}>
          <div>Sr</div>
          <div>Date</div>
          <div>Group</div>
          <div>To</div>
          <div>Task</div>
          <div>Details</div>
          <div>Status</div>
          <div />
        </div>

        {/* Manual entry BELOW headers */}
        <div
          className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center`}
          data-testid="task-add-row"
        >
          <div className="mm-text-gold/60 text-xs">#new</div>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-date"
          />
          <input
            list="task-groups"
            placeholder={activeGroup || "Group"}
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-group"
          />
          <input
            list="task-people"
            placeholder="Person"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-name"
          />
          <input
            placeholder="Task (one-word verb)"
            value={draft.task}
            onChange={(e) => setDraft({ ...draft, task: e.target.value })}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-input"
          />
          <input
            placeholder="Details"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
            className="mm-input text-xs !py-1.5"
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="mm-input text-xs !py-1.5"
          >
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={create}
            disabled={!draft.task.trim()}
            className="mm-btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 !py-1.5"
            data-testid="new-task-submit"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <EmptyState
            title="No tasks match"
            hint="Try a different group or clear filters."
          />
        ) : (
          visible.map((t, idx) => (
            <div
              key={t.id}
              className={`grid grid-cols-2 md:${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] transition items-center ${
                draggingId === t.id ? "opacity-40" : ""
              }`}
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
                list="task-groups"
                defaultValue={t.group || ""}
                onBlur={(e) => patch(t.id, { group: capWords(e.target.value) })}
                placeholder="—"
                className="mm-input text-xs !py-1.5"
              />
              <input
                list="task-people"
                defaultValue={t.name || ""}
                onBlur={(e) => patch(t.id, { name: capWords(e.target.value) })}
                placeholder="—"
                className="mm-input text-xs !py-1.5"
              />
              <input
                defaultValue={t.task}
                onBlur={(e) => patch(t.id, { task: capWords(e.target.value) })}
                className="mm-input text-xs !py-1.5"
                data-testid="task-edit-title"
              />
              <input
                defaultValue={t.details || ""}
                onBlur={(e) => patch(t.id, { details: capWords(e.target.value) })}
                placeholder="—"
                className="mm-input text-xs !py-1.5"
              />
              <select
                value={t.status}
                onChange={(e) => patch(t.id, { status: e.target.value })}
                className="mm-input text-xs !py-1.5"
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <RowActions
                testId="task"
                draggable
                onDragStart={onDragStart(t.id)}
                onDragOver={onDragOver(t.id)}
                onDrop={onDrop(t.id)}
                onDragEnd={onDragEnd}
                onUp={idx > 0 ? () => move(t.id, -1) : undefined}
                onDown={idx < visible.length - 1 ? () => move(t.id, 1) : undefined}
                onReminder={() => addAsReminder(t)}
                onDelete={() => remove(t.id)}
              />
            </div>
          ))
        )}
      </Card>

      {/* Datalists for autofill */}
      <datalist id="task-groups">
        {groups.map((g) => <option key={g} value={g} />)}
      </datalist>
      <datalist id="task-people">
        {people.map((p) => <option key={p} value={p} />)}
      </datalist>

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="task"
        describe={(r) =>
          `${r.name ? r.name + " · " : ""}${r.task || "(task)"}${r.date ? " · " + r.date : ""} · ${r.status || "Pending"}`
        }
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
