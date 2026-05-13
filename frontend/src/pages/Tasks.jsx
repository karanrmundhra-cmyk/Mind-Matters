import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import ReminderDialog from "@/components/ReminderDialog";
import FilterHeader from "@/components/FilterHeader";
import { useReorder } from "@/lib/useReorder";
import { Plus, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@/lib/format";

const STATUSES = ["Pending", "Completed", "Follow-Up"];

const TASK_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "140px" },
  { key: "group", label: "Group", type: "text", width: "120px" },
  { key: "name", label: "To", type: "text", width: "140px" },
  { key: "task", label: "Task", type: "text", width: "1.2fr" },
  { key: "details", label: "Details", type: "text", width: "1fr" },
  { key: "status", label: "Status", type: "select", options: STATUSES, width: "130px" },
];

const GRID = "md:grid-cols-[60px_140px_120px_140px_1.1fr_1fr_130px_140px]";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reminderFor, setReminderFor] = useState(null); // {row} or null
  const [filters, setFilters] = useState({ sr: "", date: "", group: "", name: "", task: "", details: "", status: "" });
  const [draft, setDraft] = useState({
    date: todayISO(),
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
  const taskTitles = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.task).filter(Boolean))),
    [tasks],
  );
  const dateOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.date).filter(Boolean))).sort().reverse(),
    [tasks],
  );
  const detailOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.details).filter(Boolean))),
    [tasks],
  );
  const srOptions = useMemo(
    () => tasks.map((t) => String(t.sr_no || "")).filter(Boolean),
    [tasks],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set([...STATUSES, ...tasks.map((t) => t.status).filter(Boolean)])),
    [tasks],
  );

  const textMatch = (a, b) => (!b ? true : String(a || "").toLowerCase().includes(b.toLowerCase()));

  const isDone = (t) => t.status === "Completed" || t.status === "Done";

  const visible = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (activeGroup && t.group !== activeGroup) return false;
      if (filters.sr && String(t.sr_no) !== filters.sr) return false;
      if (!textMatch(t.date, filters.date)) return false;
      if (!textMatch(t.group, filters.group)) return false;
      if (!textMatch(t.name, filters.name)) return false;
      if (!textMatch(t.task, filters.task)) return false;
      if (!textMatch(t.details, filters.details)) return false;
      if (filters.status && t.status !== filters.status) return false;
      return true;
    });
    // Completed/Done tasks go to the bottom; preserve relative order otherwise.
    return [...filtered].sort((a, b) => {
      const ad = isDone(a) ? 1 : 0;
      const bd = isDone(b) ? 1 : 0;
      return ad - bd;
    });
  }, [tasks, activeGroup, filters]);

  const pendingCount = tasks.filter((t) => t.status === "Pending").length;

  // Move focus to the next focusable input/select within the same row when Enter is pressed.
  // If the current element is a <select> with the dropdown open, the browser will handle Enter
  // (closing the dropdown) and we don't intercept.
  const advanceOnEnter = (e) => {
    if (e.key !== "Enter") return;
    const tag = e.currentTarget.tagName;
    e.preventDefault();
    const row = e.currentTarget.closest('[data-row]');
    if (!row) return;
    const fields = Array.from(row.querySelectorAll("input,select")).filter(
      (el) => !el.disabled && el.type !== "hidden",
    );
    const idx = fields.indexOf(e.currentTarget);
    if (idx >= 0 && idx < fields.length - 1) {
      fields[idx + 1].focus();
      if (fields[idx + 1].select) fields[idx + 1].select?.();
    }
    // suppress unused
    void tag;
  };

  const insertOne = async (row) => {
    const status = row.status === "Done" ? "Completed" : (row.status || "Pending");
    const { data } = await api.post("/tasks", {
      date: row.date || todayISO(),
      group: row.group || activeGroup || "",
      name: row.name || "",
      task: row.task || "",
      details: row.details || "",
      status,
    });
    // If the AI extracted a reminder time, auto-create a reminder linked to this task.
    if (row.reminder_at) {
      try {
        const fire_iso = new Date(row.reminder_at).toISOString();
        await api.post("/reminders", {
          title: row.task ? `${row.task}${row.name ? " — " + row.name : ""}` : (row.task || "Task"),
          notes: [row.name && `To: ${row.name}`, row.details].filter(Boolean).join(" — "),
          fire_at: fire_iso,
          recurrence: "none",
          source_page: "tasks",
          source_context: {
            sr_no: data?.sr_no, date: data?.date, group: data?.group,
            to: data?.name, task: data?.task, details: data?.details, status: data?.status,
          },
        });
      } catch {
        /* non-fatal */
      }
    }
    return data;
  };

  const create = async () => {
    if (!draft.task.trim()) {
      toast.error("Task is required");
      return;
    }
    try {
      await insertOne({ ...draft, group: draft.group || activeGroup });
      setDraft({
        date: todayISO(),
        group: draft.group,
        name: "",
        task: "",
        details: "",
        status: "Pending",
      });
      await load();
      toast.success("Task added");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
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

  const openReminderFor = (t) =>
    setReminderFor({
      title: t.task || "Task",
      notes: [t.name && `To: ${t.name}`, t.details].filter(Boolean).join(" — "),
      source_page: "tasks",
      source_context: {
        sr_no: t.sr_no, date: t.date, group: t.group, to: t.name,
        task: t.task, details: t.details, status: t.status,
      },
    });

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
        Capture every commitment. Tick them off as you go.
      </p>

      <AiAddBar
        kind="task"
        placeholder="e.g. remind rahul to send invoice tomorrow #Work"
        columns={TASK_COLUMNS}
        quickTags={groups}
        quickTagPrefix="Group: "
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <GroupTabs groups={groups} active={activeGroup} onChange={setActiveGroup} onAdd={newGroupPrompt} />

      <Card className="p-0 overflow-hidden" data-testid="tasks-table">
        {/* Headers with filter icons */}
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)]`}>
          <FilterHeader label="Sr" value={filters.sr} options={srOptions} onChange={(v) => setFilters((f) => ({ ...f, sr: v }))} testId="filter-sr" />
          <FilterHeader label="Date" value={filters.date} options={dateOptions} onChange={(v) => setFilters((f) => ({ ...f, date: v }))} testId="filter-date" />
          <FilterHeader label="Group" value={filters.group} options={groups} onChange={(v) => setFilters((f) => ({ ...f, group: v }))} testId="filter-group" />
          <FilterHeader label="To" value={filters.name} options={people} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} testId="filter-to" />
          <FilterHeader label="Task" value={filters.task} options={taskTitles} onChange={(v) => setFilters((f) => ({ ...f, task: v }))} testId="filter-task" />
          <FilterHeader label="Details" value={filters.details} options={detailOptions} onChange={(v) => setFilters((f) => ({ ...f, details: v }))} testId="filter-details" />
          <FilterHeader label="Status" value={filters.status} options={statusOptions} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} testId="filter-status" />
          <div />
        </div>

        {/* Manual entry row BELOW headers */}
        <div
          className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center`}
          data-testid="task-add-row"
          data-row="entry"
        >
          <div className="mm-text-gold/60 text-xs">#new</div>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-date"
          />
          <input
            list="task-groups"
            placeholder={activeGroup || "+ Create Custom"}
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-group"
          />
          <input
            list="task-people"
            placeholder="+ Create Custom"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-to"
          />
          <input
            list="task-titles"
            placeholder="+ Create Custom"
            value={draft.task}
            onChange={(e) => setDraft({ ...draft, task: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-task-task"
          />
          <input
            list="task-details"
            placeholder="+ Create Custom"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
          />
          <input
            list="task-statuses"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
            className="mm-input text-xs !py-1.5"
            placeholder="+ Create Custom"
          />
          <button
            onClick={create}
            disabled={!draft.task.trim()}
            className="mm-btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 !py-1.5"
            data-testid="new-task-submit"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No tasks match" hint="Try a different group or clear filters." />
        ) : (
          visible.map((t, idx) => (
            <div
              key={t.id}
              className={`grid grid-cols-2 ${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] transition items-center ${
                draggingId === t.id ? "opacity-40" : ""
              }`}
              data-testid="task-row"
              data-row="data"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => patch(t.id, { status: isDone(t) ? "Pending" : "Completed" })}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 ${
                    isDone(t)
                      ? "bg-gradient-to-br from-[#E4C98C] to-[#C9A961] border-[#C9A961] text-black"
                      : "border-[rgba(201,169,97,0.35)] hover:border-[#E4C98C]"
                  }`}
                  data-testid="task-tick"
                  title="Mark done"
                >
                  {isDone(t) && <Check size={11} strokeWidth={2.5} />}
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={t.sr_no || ""}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (n && n !== t.sr_no) patch(t.id, { sr_no: n });
                    else e.target.value = t.sr_no || "";
                  }}
                  onKeyDown={advanceOnEnter}
                  className="mm-input-ghost text-xs !py-1.5 w-12 text-center"
                  data-testid="task-sr-input"
                  title="Edit to renumber, or use the up/down arrows on the right"
                />
              </div>
              <input
                type="date"
                value={t.date || ""}
                onChange={(e) => patch(t.id, { date: e.target.value })}
                onKeyDown={advanceOnEnter}
                className="mm-input-ghost text-xs !py-1.5"
              />
              <input
                list="task-groups"
                defaultValue={t.group || ""}
                onBlur={(e) => patch(t.id, { group: e.target.value })}
                onKeyDown={advanceOnEnter}
                placeholder="—"
                className="mm-input-ghost text-xs !py-1.5"
              />
              <input
                list="task-people"
                defaultValue={t.name || ""}
                onBlur={(e) => patch(t.id, { name: e.target.value })}
                onKeyDown={advanceOnEnter}
                placeholder="—"
                className="mm-input-ghost text-xs !py-1.5"
              />
              <input
                list="task-titles"
                defaultValue={t.task}
                onBlur={(e) => patch(t.id, { task: e.target.value })}
                onKeyDown={advanceOnEnter}
                className="mm-input-ghost text-xs !py-1.5"
                data-testid="task-edit-title"
              />
              <input
                list="task-details"
                defaultValue={t.details || ""}
                onBlur={(e) => patch(t.id, { details: e.target.value })}
                onKeyDown={advanceOnEnter}
                placeholder="—"
                className="mm-input-ghost text-xs !py-1.5"
              />
              <select
                value={statusOptions.includes(t.status) ? t.status : (t.status || "Pending")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    const custom = window.prompt("New status name?", "");
                    if (custom && custom.trim()) patch(t.id, { status: custom.trim() });
                    else e.target.value = t.status;
                  } else {
                    patch(t.id, { status: v });
                  }
                }}
                onKeyDown={advanceOnEnter}
                className="mm-input-ghost text-xs !py-1.5"
                data-testid="task-status-select"
              >
                {!statusOptions.includes(t.status) && t.status && (
                  <option key={t.status} value={t.status}>{t.status}</option>
                )}
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__custom__">+ Custom…</option>
              </select>
              <RowActions
                kind="task"
                rowId={t.id}
                draggable
                onDragStart={onDragStart(t.id)}
                onDragOver={onDragOver(t.id)}
                onDrop={onDrop(t.id)}
                onDragEnd={onDragEnd}
                onUp={idx > 0 ? () => move(t.id, -1) : undefined}
                onDown={idx < visible.length - 1 ? () => move(t.id, 1) : undefined}
                onReminder={() => openReminderFor(t)}
                onDelete={() => remove(t.id)}
              />
            </div>
          ))
        )}
      </Card>

      <datalist id="task-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="task-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="task-titles">{taskTitles.map((tt) => <option key={tt} value={tt} />)}</datalist>
      <datalist id="task-details">
        {Array.from(new Set(tasks.map((t) => t.details).filter(Boolean))).map((d) => <option key={d} value={d} />)}
      </datalist>
      <datalist id="task-statuses">
        {Array.from(new Set([...STATUSES, ...tasks.map((t) => t.status).filter(Boolean)])).map((s) => <option key={s} value={s} />)}
      </datalist>

      <ReminderDialog
        open={!!reminderFor}
        onClose={() => setReminderFor(null)}
        defaults={reminderFor || {}}
      />

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="task"
        columns={TASK_COLUMNS}
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
