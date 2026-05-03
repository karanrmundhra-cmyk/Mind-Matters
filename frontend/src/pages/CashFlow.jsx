import React, { useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import { useReorder } from "@/lib/useReorder";
import { Plus, Upload, Check, X, Filter } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const CATEGORIES = ["income", "expense", "asset", "liability"];
const CAT_LABEL = {
  income: "Income",
  expense: "Expense",
  asset: "Asset",
  liability: "Liability",
};

// AI preview uses the same column order as the table
const TX_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "120px" },
  { key: "group", label: "Group", type: "text", width: "120px" },
  { key: "name", label: "Name", type: "text", width: "1fr" },
  { key: "details", label: "Details", type: "text", width: "1.2fr" },
  { key: "amount", label: "Amount", type: "number", width: "110px" },
  { key: "remarks", label: "Remarks", type: "text", width: "1fr" },
  { key: "head", label: "Head", type: "text", width: "120px" },
  { key: "category", label: "Category", type: "select", options: CATEGORIES, width: "120px" },
];

const GRID =
  "grid-cols-[50px_105px_110px_1fr_1fr_110px_1fr_110px_110px_150px]";

export default function CashFlow() {
  const [rows, setRows] = useState([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [stmtBusy, setStmtBusy] = useState(false);
  const stmtRef = useRef(null);
  const [draft, setDraft] = useState({
    date: "",
    group: "",
    name: "",
    details: "",
    amount: "",
    remarks: "",
    head: "",
    category: "expense",
  });

  const load = async () => {
    const { data } = await api.get("/transactions");
    setRows(data);
  };
  useEffect(() => {
    load();
  }, []);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("transactions", rows, setRows);

  const groups = useMemo(
    () => Array.from(new Set(rows.map((r) => r.group).filter(Boolean))).sort(),
    [rows],
  );
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (activeGroup && (r.group || "") !== activeGroup) return false;
        if (catFilter && (r.category || (r.direction === "in" ? "income" : "expense")) !== catFilter) return false;
        return true;
      }),
    [rows, activeGroup, catFilter],
  );

  // Totals per category, filtered
  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, asset: 0, liability: 0 };
    for (const r of visible) {
      const c = r.category || (r.direction === "in" ? "income" : "expense");
      t[c] = (t[c] || 0) + Number(r.amount || 0);
    }
    return t;
  }, [visible]);

  const balance = (totals.income - totals.expense) + (totals.asset - totals.liability);

  const insertOne = async (row) => {
    const cat = (row.category || "expense").toLowerCase();
    await api.post("/transactions", {
      date: row.date || null,
      amount: Math.abs(Number(row.amount) || 0),
      group: capWords(row.group || activeGroup || "General"),
      name: capWords(row.name || row.company || ""),
      details: capWords(row.details || row.notes || ""),
      remarks: capWords(row.remarks || ""),
      head: capWords(row.head || row.expense_head || "Uncategorized"),
      category: CATEGORIES.includes(cat) ? cat : "expense",
      // legacy mirrors (kept for back-compat)
      company: capWords(row.name || row.company || ""),
      notes: capWords(row.details || row.notes || ""),
      expense_head: capWords(row.head || row.expense_head || "Uncategorized"),
      direction: cat === "income" || cat === "asset" ? "in" : "out",
      mode: row.mode || "Bank",
    });
  };

  const add = async () => {
    if (!Number(draft.amount)) return;
    try {
      let head = draft.head;
      if (!head) {
        try {
          const { data } = await api.post("/parse/bulk", {
            kind: "expense",
            text: `${draft.date || ""} ${draft.amount} ${draft.details || ""} ${draft.name || ""}`.trim(),
          });
          head = data.rows?.[0]?.expense_head || "Uncategorized";
        } catch {}
      }
      await insertOne({ ...draft, head, group: draft.group || activeGroup });
      setDraft({
        date: "",
        group: draft.group,
        name: "",
        details: "",
        amount: "",
        remarks: "",
        head: "",
        category: draft.category,
      });
      await load();
      toast.success("Entry added");
    } catch {
      toast.error("Failed");
    }
  };

  const patch = async (id, body) => {
    await api.patch(`/transactions/${id}`, body);
    await load();
  };
  const remove = async (id) => {
    await api.delete(`/transactions/${id}`);
    await load();
  };

  const addAsReminder = async (r) => {
    try {
      const base = r.date ? new Date(r.date + "T09:00:00") : new Date(Date.now() + 24 * 3600 * 1000);
      await api.post("/reminders", {
        title: `${CAT_LABEL[r.category] || "Cash"}: ${r.name || r.head || "entry"}`,
        notes: [r.details, r.remarks, fmtINR(r.amount)].filter(Boolean).join(" — "),
        fire_at: base.toISOString(),
        recurrence: "none",
        source_page: "cash-flow",
        source_context: {
          sr_no: r.sr_no, date: r.date, group: r.group, name: r.name,
          details: r.details, amount: r.amount, remarks: r.remarks,
          head: r.head, category: r.category,
        },
      });
      toast.success("Reminder created");
    } catch {
      toast.error("Reminder failed");
    }
  };

  const uploadStatement = async (file) => {
    if (!file) return;
    setStmtBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("skip_duplicates", "true");
      const { data } = await api.post("/transactions/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.inserted) toast.success(`${data.inserted} added`);
      if (data.duplicate_count) {
        toast(`${data.duplicate_count} possible duplicate(s) — review`);
        setDuplicates(data.duplicates || []);
      }
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setStmtBusy(false);
      if (stmtRef.current) stmtRef.current.value = "";
    }
  };

  const newGroupPrompt = () => {
    const g = window.prompt("New group (e.g. Personal, Business, Brinda)?", "");
    if (g && g.trim()) setActiveGroup(g.trim());
  };

  const keepDup = async (idx) => {
    const d = duplicates[idx];
    try {
      await insertOne({
        date: d.date, amount: d.amount, name: d.company, details: d.notes,
        head: d.expense_head, category: d.direction === "in" ? "income" : "expense",
      });
      setDuplicates((a) => a.filter((_, i) => i !== idx));
      await load();
    } catch {
      toast.error("Failed");
    }
  };
  const skipDup = (idx) => setDuplicates((a) => a.filter((_, i) => i !== idx));

  return (
    <div className="space-y-5 mm-fade-in" data-testid="cashflow-page">
      <SectionTitle
        subtitle="Money, loans, investments & insurance"
        title="Cash Flow"
        right={
          <div className="flex items-center gap-2">
            <span className="mm-chip" data-testid="cf-balance-chip">
              Net {fmtINR(balance)}
            </span>
            <input
              ref={stmtRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(e) => uploadStatement(e.target.files?.[0])}
              data-testid="stmt-file-input"
            />
            <button
              onClick={() => stmtRef.current?.click()}
              disabled={stmtBusy}
              className="mm-btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-40"
              data-testid="stmt-upload-btn"
            >
              <Upload size={12} /> {stmtBusy ? "Reading…" : "Upload"}
            </button>
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
        Unified ledger — log income, expenses, assets (investments) and liabilities (loans, insurance
        premiums). Group them any way you like; totals update per group.
      </p>

      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat testid="cashflow-tile-income" label="Income" value={fmtINR(totals.income)} />
        <Stat testid="cashflow-tile-expense" label="Expense" value={fmtINR(totals.expense)} />
        <Stat testid="cashflow-tile-asset" label="Assets" value={fmtINR(totals.asset)} />
        <Stat testid="cashflow-tile-liability" label="Liabilities" value={fmtINR(totals.liability)} />
      </div>

      <AiAddBar
        kind="expense"
        placeholder="e.g. Lent Brinda 50000 at 9% · SBI FD 200000 at 7.1% · LIC term plan 50000 for wife · 450 coffee at Starbucks"
        columns={TX_COLUMNS}
        onConfirm={async (arr) => {
          for (const r of arr) await insertOne(r);
          await load();
        }}
      />

      {duplicates.length > 0 && (
        <Card className="p-0 overflow-hidden border-[#C9A961]/40" data-testid="duplicates-review">
          <div className="px-4 py-3 border-b border-[rgba(201,169,97,0.18)] flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
              {duplicates.length} possible duplicate{duplicates.length !== 1 ? "s" : ""} — review
            </div>
            <button onClick={() => setDuplicates([])} className="mm-btn-ghost text-xs" data-testid="dup-discard-all">
              Discard all
            </button>
          </div>
          {duplicates.map((d, idx) => (
            <div key={idx} className="grid grid-cols-[100px_90px_120px_1.4fr_1fr_180px] gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] items-center" data-testid="dup-row">
              <div className="text-xs">{d.date}</div>
              <div className={`text-xs font-medium ${d.direction === "in" ? "text-emerald-300" : "mm-text-gold-bright"}`}>{fmtINR(d.amount)}</div>
              <div className="text-xs">{d.expense_head}</div>
              <div className="text-xs truncate">{d.notes || "—"}</div>
              <div className="text-xs text-[#B7A98A]/65 truncate">{d.company || "—"}</div>
              <div className="flex gap-2 justify-self-end">
                <button onClick={() => skipDup(idx)} className="mm-btn-ghost text-xs flex items-center gap-1" data-testid="dup-skip"><X size={12}/>Skip</button>
                <button onClick={() => keepDup(idx)} className="mm-btn-primary text-xs flex items-center gap-1" data-testid="dup-keep"><Check size={12}/>Keep</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Filter bar */}
      <Card className="p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="flex items-center gap-2 text-[#B7A98A]/65 text-xs uppercase tracking-[0.2em]">
          <Filter size={12} /> Filter
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="mm-input max-w-[160px] text-sm"
          data-testid="filter-category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
      </Card>

      <GroupTabs
        groups={groups}
        active={activeGroup}
        onChange={setActiveGroup}
        onAdd={newGroupPrompt}
      />

      <Card className="p-0 overflow-hidden" data-testid="tx-table">
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60`}>
          <div>Sr</div>
          <div>Date</div>
          <div>Group</div>
          <div>Name</div>
          <div>Details</div>
          <div>Amount</div>
          <div>Remarks</div>
          <div>Head</div>
          <div>Category</div>
          <div />
        </div>

        {/* Manual entry bar BELOW headers */}
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center`} data-testid="manual-add">
          <div className="mm-text-gold/60 text-xs">#new</div>
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="mm-input text-xs !py-1.5" />
          <input list="tx-groups" placeholder={activeGroup || "Group"} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} className="mm-input text-xs !py-1.5" data-testid="new-tx-group" />
          <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mm-input text-xs !py-1.5" />
          <input placeholder="Details" value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} className="mm-input text-xs !py-1.5" />
          <input type="number" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="mm-input text-xs !py-1.5" data-testid="new-tx-amount" />
          <input placeholder="Remarks (e.g. @9% interest)" value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} className="mm-input text-xs !py-1.5" />
          <input placeholder="Head (auto)" value={draft.head} onChange={(e) => setDraft({ ...draft, head: e.target.value })} className="mm-input text-xs !py-1.5" />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="mm-input text-xs !py-1.5" data-testid="tx-add-category">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <button onClick={add} disabled={!Number(draft.amount)} className="mm-btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 !py-1.5" data-testid="new-tx-submit">
            <Plus size={13} /> Add
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No entries" hint="Use AI bar, manual row, or upload a bank statement." />
        ) : (
          visible.map((t, idx) => {
            const cat = t.category || (t.direction === "in" ? "income" : "expense");
            return (
              <div
                key={t.id}
                className={`grid grid-cols-2 md:${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center ${draggingId === t.id ? "opacity-40" : ""}`}
                data-testid="tx-row"
              >
                <div className="mm-text-gold/80 text-xs">#{t.sr_no || idx + 1}</div>
                <input type="date" value={t.date || ""} onChange={(e) => patch(t.id, { date: e.target.value })} className="mm-input text-xs !py-1.5" />
                <input list="tx-groups" defaultValue={t.group || ""} onBlur={(e) => patch(t.id, { group: capWords(e.target.value) })} className="mm-input text-xs !py-1.5" placeholder="—" />
                <input defaultValue={t.name || t.company || ""} onBlur={(e) => patch(t.id, { name: capWords(e.target.value), company: capWords(e.target.value) })} className="mm-input text-xs !py-1.5" placeholder="—" />
                <input defaultValue={t.details || t.notes || ""} onBlur={(e) => patch(t.id, { details: capWords(e.target.value), notes: capWords(e.target.value) })} className="mm-input text-xs !py-1.5" placeholder="—" />
                <input type="number" defaultValue={t.amount} onBlur={(e) => patch(t.id, { amount: Number(e.target.value) })} className="mm-input text-xs !py-1.5" />
                <input defaultValue={t.remarks || ""} onBlur={(e) => patch(t.id, { remarks: capWords(e.target.value) })} className="mm-input text-xs !py-1.5" placeholder="—" />
                <input defaultValue={t.head || t.expense_head || ""} onBlur={(e) => patch(t.id, { head: capWords(e.target.value), expense_head: capWords(e.target.value) })} className="mm-input text-xs !py-1.5" />
                <select value={cat} onChange={(e) => patch(t.id, { category: e.target.value, direction: (e.target.value === "income" || e.target.value === "asset") ? "in" : "out" })} className="mm-input text-xs !py-1.5">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
                <RowActions
                  kind="tx"
                  rowId={t.id}
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
            );
          })
        )}
      </Card>

      <datalist id="tx-groups">
        {groups.map((g) => <option key={g} value={g} />)}
      </datalist>

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="expense"
        describe={(r) =>
          `${r.date || ""} · ${fmtINR(r.amount)} · ${r.expense_head || r.head || ""}${r.company ? " · " + r.company : ""}`
        }
        onConfirm={async (arr) => {
          for (const r of arr) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
