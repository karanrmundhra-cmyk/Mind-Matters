import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, uploadRowAttachment } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import ReminderDialog from "@/components/ReminderDialog";
import CommentDrawer from "@/components/CommentDrawer";
import FilterHeader from "@/components/FilterHeader";
import ExportButton from "@/components/ExportButton";
import AttachmentsDialog from "@/components/AttachmentsDialog";
import SectionBar from "@/components/SectionBar";
import AddSectionButton from "@/components/AddSectionButton";
import SectionPicker from "@/components/SectionPicker";
import { useReorder } from "@/lib/useReorder";
import { useProjectReload, useProjects } from "@/lib/projects";
import { nestRows, depthPaddingClass } from "@/lib/nestRows";
import { validateAttachment } from "@/lib/attachments";
import { useSections } from "@/lib/useSections";
import { Plus, Flame, Check, Upload } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FREQS = ["Daily", "Weekly", "Every 2 Weeks", "Monthly", "Every 2 Months", "Quarterly", "Half-Yearly", "Yearly"];

const ROUTINE_COLUMNS = [
  { key: "group", label: "Group", type: "text", width: "140px" },
  { key: "name", label: "Name", type: "text", width: "140px" },
  { key: "activity", label: "Task", type: "text", width: "1.2fr" },
  { key: "details", label: "Details", type: "text", width: "1.2fr" },
  { key: "frequency", label: "Frequency", type: "text", width: "140px" },
];

const GRID = "grid-cols-[56px_120px_120px_1fr_1fr_120px_130px] md:grid-cols-[60px_140px_140px_1.1fr_1.1fr_140px_140px]";

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeGroup, setActiveGroup] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reminderFor, setReminderFor] = useState(null);
  const [attachFor, setAttachFor] = useState(null);
  const [commentFor, setCommentFor] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});
  const [sectionPickerFor, setSectionPickerFor] = useState(null);
  const { currentId: projectId } = useProjects();
  const sect = useSections(projectId, "routines");
  const [filters, setFilters] = useState({ sr: "", group: "", name: "", activity: "", details: "", frequency: "" });
  const [draft, setDraft] = useState({
    group: "",
    name: "",
    activity: "",
    details: "",
    frequency: "",
  });

  const load = async () => {
    const [r, s] = await Promise.all([api.get("/routines"), api.get("/routines/summary")]);
    setRoutines(r.data);
    setSummary(s.data);
    if (projectId) {
      try {
        const { data: counts } = await api.get(
          `/comments/counts?project_id=${projectId}&resource_type=routine`,
        );
        setCommentCounts(counts || {});
      } catch { /* */ }
    }
  };
  useEffect(() => {
    load();
  }, []);
  useProjectReload(load);
  useProjectReload(sect.load);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("routines", routines, setRoutines, { onCommit: load });

  const moveRowToSection = async (sectionId) => {
    const id = draggingId;
    if (!id) return;
    try {
      await api.patch(`/routines/${id}`, { section_id: sectionId });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not move");
    }
  };

  const groups = useMemo(
    () => Array.from(new Set(routines.map((r) => r.group).filter(Boolean))).sort(),
    [routines],
  );
  const names = useMemo(
    () => Array.from(new Set(routines.map((r) => r.name).filter(Boolean))),
    [routines],
  );
  const activities = useMemo(
    () => Array.from(new Set(routines.map((r) => r.activity).filter(Boolean))),
    [routines],
  );
  const detailsOpts = useMemo(
    () => Array.from(new Set(routines.map((r) => r.details).filter(Boolean))),
    [routines],
  );
  const srOptions = useMemo(
    () => routines.map((r) => String(r.sr_no || "")).filter(Boolean),
    [routines],
  );
  const freqs = useMemo(
    () => Array.from(new Set([...DEFAULT_FREQS, ...routines.map((r) => r.frequency).filter(Boolean)])),
    [routines],
  );
  // Only show filter options for frequencies actually present in the data
  // (so the dropdown doesn't list values that don't exist).
  const freqOptionsInData = useMemo(
    () => Array.from(new Set(routines.map((r) => r.frequency).filter(Boolean))),
    [routines],
  );

  const textMatch = (a, b) => (!b ? true : String(a || "").toLowerCase().includes(b.toLowerCase()));

  const advanceOnEnter = (e) => {
    if (e.key !== "Enter") return;
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
  };

  const routineMatches = useCallback((r) => {
    if (activeGroup && r.group !== activeGroup) return false;
    if (filters.sr && String(r.sr_no || "") !== filters.sr) return false;
    if (!textMatch(r.group, filters.group)) return false;
    if (!textMatch(r.name, filters.name)) return false;
    if (!textMatch(r.activity, filters.activity)) return false;
    if (!textMatch(r.details, filters.details)) return false;
    if (!textMatch(r.frequency, filters.frequency)) return false;
    return true;
  }, [activeGroup, filters]);

  const visible = useMemo(
    () => nestRows(routines, { matches: routineMatches, maxDepth: 2 }),
    [routines, routineMatches],
  );

  const filteredIds = useMemo(
    () => routines.filter(routineMatches).map((r) => r.id),
    [routines, routineMatches],
  );

  const createSubroutine = async (parent) => {
    const title = window.prompt(`New sub-routine under "${parent.activity || "(routine)"}":`, "");
    if (!title || !title.trim()) return;
    try {
      await api.post("/routines", {
        group: parent.group || activeGroup || "General",
        name: parent.name || "",
        activity: title.trim(),
        details: "",
        frequency: parent.frequency || "Daily",
        parent_id: parent.id,
      });
      await load();
      toast.success("Sub-routine added");
    } catch { toast.error("Could not add"); }
  };

  const insertOne = async (row) => {
    await api.post("/routines", {
      group: row.group || activeGroup || "General",
      name: row.name || "",
      activity: row.activity || "",
      details: row.details || "",
      frequency: row.frequency || "Daily",
    });
  };

  const add = async () => {
    if (!draft.activity.trim()) {
      toast.error("Task is required");
      return;
    }
    try {
      await insertOne(draft);
      setDraft({ group: draft.group, name: "", activity: "", details: "", frequency: draft.frequency });
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

  const openReminderFor = (r, anchor) =>
    setReminderFor({
      anchor,
      defaults: {
        title: r.activity || "Routine",
        notes: [r.group && `Group: ${r.group}`, r.name && `Name: ${r.name}`, r.details, `Freq: ${r.frequency}`].filter(Boolean).join(" — "),
        source_page: "routines",
        source_context: {
          group: r.group, name: r.name, activity: r.activity, details: r.details, frequency: r.frequency,
        },
      },
    });

  const newGroupPrompt = () => {
    const g = window.prompt("New group name (e.g. Morning, Evening, 4-Hour Focus)?", "");
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
            {routines.some((r) => r.status === "Done" || r.status === "Completed") && (
              <button
                onClick={async () => {
                  const n = routines.filter((r) => r.status === "Done" || r.status === "Completed").length;
                  if (!window.confirm(`Delete ${n} completed routine${n !== 1 ? "s" : ""}?`)) return;
                  try {
                    const { data } = await api.delete("/routines/completed");
                    toast.success(`Deleted ${data.deleted} completed`);
                    await load();
                  } catch (e) {
                    toast.error(e?.response?.data?.detail || "Failed");
                  }
                }}
                className="mm-btn-ghost text-xs flex items-center gap-1.5 text-[#B7A98A]/75 hover:text-red-300"
                data-testid="routines-bulk-delete-completed"
                title="Bulk delete all completed routines"
              >
                Clear done
              </button>
            )}
            <button
              onClick={() => setBulkOpen(true)}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="bulk-add-open"
            >
              <Upload size={12} /> Import
            </button>
            <ExportButton
              module="routines"
              filteredIds={filteredIds}
              totalCount={routines.length}
            />
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        Your daily rituals — the master list never disappears, the ticks reset every morning.
      </p>

      <AiAddBar
        kind="routine"
        placeholder="e.g. morning walk at park daily, self #Morning"
        columns={ROUTINE_COLUMNS}
        quickTags={groups}
        quickTagPrefix="Group: "
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <GroupTabs groups={groups} active={activeGroup} onChange={setActiveGroup} onAdd={newGroupPrompt} />

      <Card className="p-0 overflow-hidden" data-testid="routines-table">
        <div className="mm-table-wrap overflow-x-auto md:overflow-visible">
        <div className={`grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)] min-w-[800px] md:min-w-0`}>
          <FilterHeader label="Sr" value={filters.sr} options={srOptions} onChange={(v) => setFilters((f) => ({ ...f, sr: v }))} />
          <FilterHeader label="Group" value={filters.group} options={groups} onChange={(v) => setFilters((f) => ({ ...f, group: v }))} />
          <FilterHeader label="Name" value={filters.name} options={names} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
          <FilterHeader label="Task" value={filters.activity} options={activities} onChange={(v) => setFilters((f) => ({ ...f, activity: v }))} />
          <FilterHeader label="Details" value={filters.details} options={detailsOpts} onChange={(v) => setFilters((f) => ({ ...f, details: v }))} />
          <FilterHeader label="Frequency" value={filters.frequency} options={freqOptionsInData} onChange={(v) => setFilters((f) => ({ ...f, frequency: v }))} />
          <div />
        </div>

        {/* Manual entry bar BELOW headers */}
        <div
          className={`grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center min-w-[800px] md:min-w-0`}
          data-testid="routine-add-row"
          data-row="entry"
        >
          <div className="mm-text-gold/60 text-xs mm-frozen-col px-1">#new</div>
          <input
            list="routine-groups"
            placeholder={activeGroup || "+ Group"}
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-routine-group"
          />
          <input
            list="routine-names"
            placeholder="+ Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-routine-name"
          />
          <input
            list="routine-activities"
            className="mm-input text-xs !py-1.5"
            placeholder="+ Task"
            value={draft.activity}
            onChange={(e) => setDraft({ ...draft, activity: e.target.value })}
            onKeyDown={advanceOnEnter}
            data-testid="new-routine-activity"
          />
          <input
            list="routine-details"
            className="mm-input text-xs !py-1.5"
            placeholder="+ Create Custom"
            value={draft.details}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
            onKeyDown={advanceOnEnter}
          />
          <select
            value={draft.frequency}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                const custom = window.prompt("Custom frequency (e.g. 'Twice a week')?", "");
                if (custom && custom.trim()) setDraft({ ...draft, frequency: custom.trim() });
              } else {
                setDraft({ ...draft, frequency: v });
              }
            }}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="new-routine-frequency"
          >
            {freqs.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="__custom__">+ Custom…</option>
          </select>
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
          <EmptyState title={activeGroup ? `No routines in "${activeGroup}"` : "No routines yet"} hint="Add via AI, the row above, or Import." />
        ) : (
          (() => {
            const sectionIds = new Set(sect.sections.map((s) => s.id));
            const grouped = { _none: [] };
            sect.sections.forEach((s) => { grouped[s.id] = []; });
            visible.forEach((r) => {
              const sid = r.section_id && sectionIds.has(r.section_id) ? r.section_id : "_none";
              grouped[sid].push(r);
            });
            const order = ["_none", ...sect.sections.map((s) => s.id)];
            const showNoneHeader = sect.sections.length > 0;
            const nodes = [];
            let runningIdx = 0;
            const renderRow = (r, idx) => {
              const info = summary?.per_routine?.[r.id];
              const done = info?.done_today;
              const streak = info?.streak || 0;
              const inSection = !!(r.section_id && sectionIds.has(r.section_id));
              return (
                <div
                  key={r.id}
                  className={`grid ${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center min-w-[800px] md:min-w-0 ${
                    draggingId === r.id ? "opacity-40" : ""
                  } ${r._isSubtask ? `${depthPaddingClass(r._depth || 1)} bg-[rgba(201,169,97,0.015)]` : ""}`}
                  data-testid={r._isSubtask ? "routine-subtask-row" : "routine-row"}
                  data-depth={r._depth || 0}
                  data-section-id={r.section_id || ""}
                  data-row="data"
                >
                  <div className="flex items-center gap-2 mm-frozen-col px-1">
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
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={r.sr_no || ""}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (n && n !== r.sr_no) patch(r.id, { sr_no: n });
                        else e.target.value = r.sr_no || "";
                      }}
                      onKeyDown={advanceOnEnter}
                      className="mm-input-ghost text-xs !py-1.5 w-12 text-center"
                      data-testid="routine-sr-input"
                      title="Edit to renumber, or use the up/down arrows on the right"
                    />
                  </div>
                  <input list="routine-groups" defaultValue={r.group || ""} onBlur={(e) => patch(r.id, { group: e.target.value })} onKeyDown={advanceOnEnter} placeholder="—" className="mm-input-ghost text-xs" />
                  <input list="routine-names" defaultValue={r.name || ""} onBlur={(e) => patch(r.id, { name: e.target.value })} onKeyDown={advanceOnEnter} placeholder="—" className="mm-input-ghost text-xs" />
                  <input list="routine-activities" defaultValue={r.activity} onBlur={(e) => patch(r.id, { activity: e.target.value })} onKeyDown={advanceOnEnter} className={`mm-input-ghost text-xs ${(r.status === "Done" || r.status === "Completed") ? "line-through opacity-55" : ""}`} />
                  <input list="routine-details" defaultValue={r.details || ""} onBlur={(e) => patch(r.id, { details: e.target.value })} onKeyDown={advanceOnEnter} placeholder="—" className="mm-input-ghost text-xs" />
                  <select
                    value={freqs.includes(r.frequency) ? r.frequency : (r.frequency || "Daily")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        const custom = window.prompt("Custom frequency (e.g. 'Twice a week')?", "");
                        if (custom && custom.trim()) patch(r.id, { frequency: custom.trim() });
                        else e.target.value = r.frequency || "Daily";
                      } else {
                        patch(r.id, { frequency: v });
                      }
                    }}
                    onKeyDown={advanceOnEnter}
                    className="mm-input-ghost text-xs"
                    data-testid="routine-frequency-select"
                  >
                    {!freqs.includes(r.frequency) && r.frequency && (
                      <option key={r.frequency} value={r.frequency}>{r.frequency}</option>
                    )}
                    {freqs.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value="__custom__">+ Custom…</option>
                  </select>
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
                      onReminder={(e) => openReminderFor(r, e.currentTarget)}
                      onAttach={(e) => setAttachFor({ row: r, anchor: e.currentTarget })}
                      onAttachFile={async (f) => {
                        const err = validateAttachment(f, r.attachments || []);
                        if (err) { toast.error(err); return; }
                        try { await uploadRowAttachment("routines", r.id, f); toast.success("Attached"); await load(); }
                        catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
                      }}
                      attachmentCount={(r.attachments || []).length}
                      onSubtask={(r._depth || 0) >= 2 ? undefined : () => createSubroutine(r)}
                      onFlag={() => patch(r.id, { flagged: !r.flagged })}
                      flagged={!!r.flagged}
                      onComment={(projectId || r.project_id) ? (e) => setCommentFor({ row: r, anchor: e.currentTarget }) : undefined}
                      commentCount={commentCounts[r.id] || 0}
                      onSection={sect.enabled ? (e) => setSectionPickerFor({ row: r, anchor: e.currentTarget }) : undefined}
                      inSection={inSection}
                      onDelete={() => remove(r.id)}
                    />
                  </div>
                </div>
              );
            };
            order.forEach((sid) => {
              const rowsInSec = grouped[sid] || [];
              if (sid === "_none") {
                if (showNoneHeader) {
                  const collapsed = sect.isCollapsed("none");
                  nodes.push(
                    <SectionBar
                      key="sec-none"
                      name="No section"
                      count={rowsInSec.length}
                      collapsed={collapsed}
                      onToggle={() => sect.toggleCollapsed("none")}
                      onDropRow={() => moveRowToSection(null)}
                      testIdPrefix="routine-section"
                      sectionKey="none"
                    />,
                  );
                  if (collapsed) return;
                }
                rowsInSec.forEach((r) => { nodes.push(renderRow(r, runningIdx)); runningIdx++; });
              } else {
                const s = sect.sections.find((x) => x.id === sid);
                if (!s) return;
                const collapsed = sect.isCollapsed(sid);
                const secIdx = sect.sections.findIndex((x) => x.id === sid);
                nodes.push(
                  <SectionBar
                    key={`sec-${sid}`}
                    name={s.name}
                    count={rowsInSec.length}
                    collapsed={collapsed}
                    onToggle={() => sect.toggleCollapsed(sid)}
                    onRename={(next) => sect.rename(sid, next)}
                    onDelete={() => {
                      if (window.confirm(`Delete section "${s.name}"? Routines stay but lose their section.`)) {
                        sect.remove(sid);
                      }
                    }}
                    onUp={secIdx > 0 ? () => sect.move(sid, -1) : undefined}
                    onDown={secIdx < sect.sections.length - 1 ? () => sect.move(sid, 1) : undefined}
                    onDropRow={() => moveRowToSection(sid)}
                    testIdPrefix="routine-section"
                    sectionKey={sid}
                  />,
                );
                if (collapsed) return;
                rowsInSec.forEach((r) => { nodes.push(renderRow(r, runningIdx)); runningIdx++; });
              }
            });
            return nodes;
          })()
        )}
        <AddSectionButton
          testIdPrefix="routine"
          onCreate={(name) => sect.create(name)}
          disabled={!sect.enabled}
          disabledHint="Pick a project to add sections"
        />
        </div>
      </Card>

      <datalist id="routine-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="routine-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="routine-activities">{activities.map((a) => <option key={a} value={a} />)}</datalist>
      <datalist id="routine-details">
        {Array.from(new Set(routines.map((r) => r.details).filter(Boolean))).map((d) => <option key={d} value={d} />)}
      </datalist>
      <datalist id="routine-freqs">{freqs.map((f) => <option key={f} value={f} />)}</datalist>

      <ReminderDialog
        open={!!reminderFor}
        onClose={() => setReminderFor(null)}
        defaults={reminderFor?.defaults || {}}
        anchor={reminderFor?.anchor}
      />

      <CommentDrawer
        open={!!commentFor}
        onClose={() => setCommentFor(null)}
        projectId={commentFor?.row?.project_id || projectId}
        resourceType="routine"
        resourceId={commentFor?.row?.id}
        resourceLabel={commentFor?.row?.activity || commentFor?.row?.name}
        onCountChange={(n) => commentFor?.row && setCommentCounts((m) => ({ ...m, [commentFor.row.id]: n }))}
        anchor={commentFor?.anchor}
      />

      <AttachmentsDialog
        open={!!attachFor}
        row={attachFor?.row}
        module="routines"
        label="Routine"
        onClose={() => setAttachFor(null)}
        anchor={attachFor?.anchor}
        onChanged={async (updated) => {
          setAttachFor((prev) => (prev ? { ...prev, row: updated } : prev));
          await load();
        }}
      />

      <SectionPicker
        open={!!sectionPickerFor}
        anchor={sectionPickerFor?.anchor}
        onClose={() => setSectionPickerFor(null)}
        sections={sect.sections}
        currentSectionId={sectionPickerFor?.row?.section_id || null}
        onPick={async (newSid) => {
          const row = sectionPickerFor?.row;
          if (!row) return;
          try {
            await api.patch(`/routines/${row.id}`, { section_id: newSid });
            await load();
          } catch (e) {
            toast.error(e?.response?.data?.detail || "Could not move");
          }
        }}
      />

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="routine"
        columns={ROUTINE_COLUMNS}
        describe={(r) => `[${r.group || "General"}] ${r.activity} · ${r.frequency || "Daily"}`}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
