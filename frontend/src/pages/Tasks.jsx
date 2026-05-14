import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import ReminderDialog from "@/components/ReminderDialog";
import FilterHeader from "@/components/FilterHeader";
import ExportButton from "@/components/ExportButton";
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
  const [attachFor, setAttachFor] = useState(null); // task object or null
  const [filters, setFilters] = useState({ sr: "", date: "", group: "", name: "", task: "", details: "", status: "" });
  const [draft, setDraft] = useState({
    date: todayISO(),
    group: "",
    name: "",
    task: "",
    details: "",
    status: "Pending",
  });

  const isDone = (t) => t.status === "Completed" || t.status === "Done";

  // Keep `tasks` array in the same order the user sees: Pending first, Completed last,
  // each group sorted by sr_no ascending. This makes the move() handler line up with
  // the visible row index (so up/down arrows operate on the right neighbour).
  const sortByDoneAndSr = (arr) =>
    [...arr].sort((a, b) => {
      const ad = isDone(a) ? 1 : 0;
      const bd = isDone(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return (a.sr_no || 0) - (b.sr_no || 0);
    });

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(sortByDoneAndSr(data));
  };
  useEffect(() => {
    load();
  }, []);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("tasks", tasks, setTasks, { onCommit: load });

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

  const visible = useMemo(() => {
    // `tasks` is already sorted Pending-first / Completed-last by load(), and each
    // group by sr_no ascending, so plain filtering preserves that order.
    return tasks.filter((t) => {
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

  // Mirror tasks into a ref so async handlers always read the latest order
  // (avoids stale closures after an optimistic reorder).
  const tasksRef = useRef([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Ticking a task → flip status AND renumber so Sr reflects the new position:
  //  - Marking Completed: push it to the very bottom (last sr_no).
  //  - Un-completing: send it to the top of the Pending list (sr_no 1).
  const toggleDone = async (id) => {
    const cur = tasksRef.current.find((x) => x.id === id);
    if (!cur) return;
    const willComplete = !isDone(cur);
    await api.patch(`/tasks/${id}`, { status: willComplete ? "Completed" : "Pending" });
    const others = tasksRef.current.filter((x) => x.id !== id).map((x) => x.id);
    const newIds = willComplete ? [...others, id] : [id, ...others];
    try { await api.post("/tasks/reorder", { ids: newIds }); } catch { /* */ }
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

  const uploadAttachment = async (taskId, file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large (max 4MB)");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/tasks/${taskId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Attachment added");
      await load();
      // Refresh the open dialog with the updated task
      const fresh = await api.get("/tasks");
      const updated = fresh.data.find((x) => x.id === taskId);
      if (updated) setAttachFor(updated);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    }
  };

  const deleteAttachment = async (taskId, attId) => {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${attId}`);
      await load();
      const fresh = await api.get("/tasks");
      const updated = fresh.data.find((x) => x.id === taskId);
      if (updated) setAttachFor(updated);
    } catch {
      toast.error("Could not delete");
    }
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
            <ExportButton module="tasks" />
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        Capture every commitment. Tick them off as you go.
      </p>

      <AiAddBar
        kind="task"
        placeholder="e.g. follow up brinda on bar unit #Personal"
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
          (() => {
            // Inject section-header rows between rows whose `section` differs from the previous.
            // If no row has any section value, behave as flat list (no headers shown).
            const anySection = visible.some((t) => (t.section || "").trim());
            let prevSection = null;
            const nodes = [];
            visible.forEach((t, idx) => {
              if (anySection) {
                const cur = (t.section || "").trim();
                if (cur !== prevSection) {
                  nodes.push(
                    <div
                      key={`sec-${idx}-${cur || "none"}`}
                      className="px-4 py-2 bg-[rgba(201,169,97,0.06)] border-b border-[rgba(201,169,97,0.12)]"
                      data-testid={`task-section-${cur || "none"}`}
                    >
                      <span className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                        {cur ? cur : "No section"}
                      </span>
                    </div>,
                  );
                  prevSection = cur;
                }
              }
              nodes.push(
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
                  onClick={() => toggleDone(t.id)}
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
                onChange={async (e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    const custom = window.prompt("New status name?", "");
                    if (custom && custom.trim()) await patch(t.id, { status: custom.trim() });
                    else e.target.value = t.status;
                    return;
                  }
                  // If toggling between Completed and a non-completed value, run the
                  // same reorder logic as the tick button so Sr numbers update too.
                  const becomingDone = v === "Completed" || v === "Done";
                  const wasDone = isDone(t);
                  if (becomingDone !== wasDone) {
                    // Drive the status change via toggleDone so the row is renumbered.
                    // We still need to honour the exact value the user picked when going to Completed/Done.
                    await api.patch(`/tasks/${t.id}`, { status: v });
                    const others = tasksRef.current.filter((x) => x.id !== t.id).map((x) => x.id);
                    const newIds = becomingDone ? [...others, t.id] : [t.id, ...others];
                    try { await api.post("/tasks/reorder", { ids: newIds }); } catch { /* */ }
                    await load();
                  } else {
                    await patch(t.id, { status: v });
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
                onAttach={() => setAttachFor(t)}
                attachmentCount={(t.attachments || []).length}
                onDelete={() => remove(t.id)}
              />
            </div>
              );
            });
            return nodes;
          })()
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

      {/* Attachments dialog — opens when paperclip is clicked */}
      {attachFor && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAttachFor(null)}
          data-testid="task-attach-dialog"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mm-glass rounded-2xl border border-[rgba(201,169,97,0.25)] p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                  Attachments
                </div>
                <div className="mm-font-display text-base mm-text-gold-bright mt-1 truncate max-w-[280px]">
                  {attachFor.task || "(task)"}
                </div>
              </div>
              <button
                onClick={() => setAttachFor(null)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition"
                data-testid="task-attach-close"
              >
                ✕
              </button>
            </div>
            <input
              type="file"
              onChange={(e) => uploadAttachment(attachFor.id, e.target.files?.[0])}
              className="block w-full text-xs text-[#B7A98A]/70 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-[#C9A961]/40 file:bg-[rgba(201,169,97,0.08)] file:text-[#E4C98C] file:cursor-pointer file:text-xs"
              data-testid="task-attach-input"
            />
            <p className="text-[10px] text-[#B7A98A]/45 mt-2">Up to 4MB per file · 8MB total.</p>
            <div className="mt-4 space-y-2 max-h-[40vh] overflow-y-auto">
              {(attachFor.attachments || []).length === 0 ? (
                <div className="text-xs text-[#B7A98A]/50 py-3 text-center">No attachments yet.</div>
              ) : (
                (attachFor.attachments || []).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(201,169,97,0.15)] px-3 py-2"
                    data-testid="task-attach-item"
                  >
                    <a
                      href={a.data_url}
                      download={a.name}
                      className="flex-1 min-w-0 text-xs mm-text-gold-bright hover:underline truncate"
                      title={a.name}
                    >
                      {a.name}
                    </a>
                    <span className="text-[10px] text-[#B7A98A]/45 shrink-0">
                      {(a.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      onClick={() => deleteAttachment(attachFor.id, a.id)}
                      className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition text-xs"
                      data-testid="task-attach-delete"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
