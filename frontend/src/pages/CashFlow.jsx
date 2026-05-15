import React, { useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import GroupTabs from "@/components/GroupTabs";
import RowActions from "@/components/RowActions";
import ReminderDialog from "@/components/ReminderDialog";
import FilterHeader from "@/components/FilterHeader";
import ExportButton from "@/components/ExportButton";
import AttachmentsDialog from "@/components/AttachmentsDialog";
import { useReorder } from "@/lib/useReorder";
import { Plus, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@/lib/format";

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const CATEGORIES = ["income", "expense", "asset", "liability", "loan_given", "loan_taken"];
const CAT_LABEL = {
  income: "Income",
  expense: "Expense",
  asset: "Asset",
  liability: "Liability",
  loan_given: "Loan Given",
  loan_taken: "Loan Taken",
};

const TX_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "120px" },
  { key: "group", label: "Group", type: "text", width: "120px" },
  { key: "vendor", label: "Vendor", type: "text", width: "1fr" },
  { key: "details", label: "Details", type: "text", width: "1.2fr" },
  { key: "amount", label: "Amount", type: "number", width: "110px" },
  { key: "mode", label: "Mode", type: "text", width: "1fr" },
  { key: "head", label: "Head", type: "text", width: "120px" },
  { key: "category", label: "Category", type: "text", width: "120px" },
];

const GRID = "md:grid-cols-[60px_140px_110px_1fr_1fr_110px_1fr_110px_120px_140px]";

export default function CashFlow() {
  const [rows, setRows] = useState([]);
  const [convertedTotals, setConvertedTotals] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [activeGroup, setActiveGroup] = useState("");
  const [duplicates, setDuplicates] = useState([]);
  const [stmtBusy, setStmtBusy] = useState(false);
  const [reminderFor, setReminderFor] = useState(null);
  const [attachFor, setAttachFor] = useState(null);
  const stmtRef = useRef(null);
  const [filters, setFilters] = useState({
    sr: "", date: "", group: "", name: "", details: "", amount: "",
    remarks: "", head: "", category: "",
  });
  const [draft, setDraft] = useState({
    date: todayISO(),
    group: "",
    vendor: "",
    details: "",
    amount: "",
    mode: "",
    head: "",
    category: "expense",
  });

  const load = async () => {
    const { data } = await api.get("/transactions");
    setRows(data);
    try {
      const u = await api.get("/cashflow/upcoming-payments");
      setUpcoming(u.data);
    } catch { /* offline-safe */ }
    try {
      const c = await api.get("/cashflow/totals?base=INR");
      setConvertedTotals(c.data.totals);
    } catch { /* offline-safe */ }
  };
  useEffect(() => {
    load();
  }, []);

  const { move, onDragStart, onDragOver, onDrop, onDragEnd, draggingId } =
    useReorder("transactions", rows, setRows, { onCommit: load });

  const groups = useMemo(
    () => Array.from(new Set(rows.map((r) => r.group).filter(Boolean))).sort(),
    [rows],
  );
  const names = useMemo(
    () => Array.from(new Set(rows.map((r) => r.vendor || r.name || r.company).filter(Boolean))),
    [rows],
  );
  const heads = useMemo(
    () => Array.from(new Set(rows.map((r) => r.head || r.expense_head).filter(Boolean))),
    [rows],
  );
  const dateOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.date).filter(Boolean))).sort().reverse(),
    [rows],
  );
  const detailOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.details || r.notes).filter(Boolean))),
    [rows],
  );
  const amountOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r.amount || "")).filter(Boolean))),
    [rows],
  );
  const modeOptions = useMemo(
    () => Array.from(new Set(["Cash", "Card", "UPI", "Bank", "Cheque", ...rows.map((r) => r.mode || r.remarks).filter(Boolean)])),
    [rows],
  );
  const srOptions = useMemo(
    () => rows.map((r) => String(r.sr_no || "")).filter(Boolean),
    [rows],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set([...rows.map((r) => r.category).filter(Boolean), ...CATEGORIES])),
    [rows],
  );
  // Filter dropdown should ONLY list categories that actually appear in the data
  const categoryOptionsInData = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))),
    [rows],
  );

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

  const txt = (a, b) => (!b ? true : String(a || "").toLowerCase().includes(b.toLowerCase()));
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (activeGroup && (r.group || "") !== activeGroup) return false;
        const cat = r.category || (r.direction === "in" ? "income" : "expense");
        if (filters.category && cat !== filters.category) return false;
        if (filters.sr && String(r.sr_no || "") !== filters.sr) return false;
        if (!txt(r.date, filters.date)) return false;
        if (!txt(r.group, filters.group)) return false;
        if (!txt(r.vendor || r.name || r.company, filters.name)) return false;
        if (!txt(r.details || r.notes, filters.details)) return false;
        if (filters.amount && String(r.amount || "").includes(filters.amount) === false) return false;
        if (!txt(r.mode || r.remarks, filters.remarks)) return false;
        if (!txt(r.head || r.expense_head, filters.head)) return false;
        return true;
      }),
    [rows, activeGroup, filters],
  );

  const totals = useMemo(() => {
    if (convertedTotals) return convertedTotals;
    const t = { income: 0, expense: 0, asset: 0, liability: 0 };
    for (const r of visible) {
      const c = r.category || (r.direction === "in" ? "income" : "expense");
      t[c] = (t[c] || 0) + Number(r.amount || 0);
    }
    return t;
  }, [visible, convertedTotals]);

  const balance = totals.income - totals.expense + totals.asset - totals.liability;

  const insertOne = async (row) => {
    const cat = (row.category || "expense").toLowerCase();
    const vendor = row.vendor || row.name || row.company || "";
    const personName = row.name && row.name !== vendor ? row.name : "";
    const mode = row.mode || row.remarks || "Bank";
    const head = row.head || row.expense_head || "";
    const details = row.details || row.notes || "";
    await api.post("/transactions", {
      date: row.date || todayISO(),
      amount: Math.abs(Number(row.amount) || 0),
      group: row.group || activeGroup || "",
      name: personName || vendor,
      vendor,
      details,
      remarks: mode,
      mode,
      head,
      category: cat,
      company: vendor,
      notes: details,
      expense_head: head,
      direction: cat === "income" || cat === "asset" ? "in" : "out",
    });
  };

  const add = async () => {
    if (!Number(draft.amount)) {
      toast.error("Amount is required");
      return;
    }
    try {
      await insertOne({ ...draft, group: draft.group || activeGroup });
      setDraft({
        date: todayISO(),
        group: draft.group,
        vendor: "",
        details: "",
        amount: "",
        mode: "",
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

  const openReminderFor = (r) =>
    setReminderFor({
      title: `${CAT_LABEL[r.category] || "Cash"}: ${r.name || r.head || "entry"}`,
      notes: [r.details, r.remarks, fmtINR(r.amount)].filter(Boolean).join(" — "),
      source_page: "cash-flow",
      source_context: {
        sr_no: r.sr_no, date: r.date, group: r.group, name: r.name,
        details: r.details, amount: r.amount, remarks: r.remarks,
        head: r.head, category: r.category,
      },
    });

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
        subtitle="All Things Money"
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
              title="Upload a .csv / .xlsx / .pdf statement or list"
            >
              <Upload size={12} /> {stmtBusy ? "Reading…" : "Upload"}
            </button>
            <ExportButton module="cashflow" />
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">Unified ledger.</p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Stat testid="cashflow-tile-income" label="Income" value={fmtINR(totals.income)} />
        <Stat testid="cashflow-tile-expense" label="Expense" value={fmtINR(totals.expense)} />
        <Stat testid="cashflow-tile-asset" label="Assets" value={fmtINR(totals.asset)} />
        <Stat testid="cashflow-tile-liability" label="Liabilities" value={fmtINR(totals.liability)} />
        <Stat
          testid="cashflow-tile-upcoming"
          label="Upcoming Payments"
          value={upcoming ? fmtINR(upcoming.total) : "—"}
          hint={upcoming ? `${upcoming.items.length} this ${upcoming.month?.split(" ")[0] || "month"}` : ""}
        />
      </div>

      <AiAddBar
        kind="expense"
        placeholder="e.g. insurance from Bajaj for Karan 5 lakhs #Family"
        columns={TX_COLUMNS}
        quickTags={groups}
        quickTagPrefix="Group: "
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

      <GroupTabs groups={groups} active={activeGroup} onChange={setActiveGroup} onAdd={newGroupPrompt} />

      <Card className="p-0 overflow-hidden" data-testid="tx-table">
        {/* Headers w/ filter icons */}
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.2)]`}>
          <FilterHeader label="Sr" value={filters.sr} options={srOptions} onChange={(v) => setFilters((f) => ({ ...f, sr: v }))} />
          <FilterHeader label="Date" value={filters.date} options={dateOptions} onChange={(v) => setFilters((f) => ({ ...f, date: v }))} />
          <FilterHeader label="Group" value={filters.group} options={groups} onChange={(v) => setFilters((f) => ({ ...f, group: v }))} />
          <FilterHeader label="Vendor" value={filters.name} options={names} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
          <FilterHeader label="Details" value={filters.details} options={detailOptions} onChange={(v) => setFilters((f) => ({ ...f, details: v }))} />
          <FilterHeader label="Amount" value={filters.amount} options={amountOptions} onChange={(v) => setFilters((f) => ({ ...f, amount: v }))} />
          <FilterHeader label="Mode" value={filters.remarks} options={modeOptions} onChange={(v) => setFilters((f) => ({ ...f, remarks: v }))} />
          <FilterHeader label="Head" value={filters.head} options={heads} onChange={(v) => setFilters((f) => ({ ...f, head: v }))} />
          <FilterHeader label="Category" value={filters.category} options={categoryOptionsInData} onChange={(v) => setFilters((f) => ({ ...f, category: v }))} />
          <div />
        </div>

        {/* Manual entry bar BELOW headers */}
        <div className={`hidden md:grid ${GRID} gap-3 px-4 py-3 border-b border-[rgba(201,169,97,0.12)] bg-[rgba(201,169,97,0.04)] items-center`} data-testid="manual-add" data-row="entry">
          <div className="mm-text-gold/60 text-xs">#new</div>
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" />
          <input list="tx-groups" placeholder={activeGroup || "+ Create Custom"} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" data-testid="new-tx-group" />
          <input list="tx-vendors" placeholder="+ Create Custom" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" />
          <input list="tx-details" placeholder="+ Create Custom" value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" />
          <input type="number" placeholder="+ Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" data-testid="new-tx-amount" />
          <input list="tx-modes" placeholder="+ Create Custom" value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" />
          <input list="tx-heads" placeholder="+ Create Custom" value={draft.head} onChange={(e) => setDraft({ ...draft, head: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input text-xs !py-1.5" />
          <select
            value={categoryOptions.includes(draft.category) ? draft.category : "expense"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                const custom = window.prompt("New category name?", "");
                if (custom && custom.trim()) setDraft({ ...draft, category: custom.trim() });
              } else {
                setDraft({ ...draft, category: v });
              }
            }}
            onKeyDown={advanceOnEnter}
            className="mm-input text-xs !py-1.5"
            data-testid="tx-add-category"
          >
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">+ Custom…</option>
          </select>
          <button onClick={add} disabled={!Number(draft.amount)} className="mm-btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 !py-1.5" data-testid="new-tx-submit">
            <Plus size={13} /> Add
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No entries" hint="Use AI bar, manual row, or upload a statement." />
        ) : (
          (() => {
            const anySection = visible.some((r) => (r.section || "").trim());
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
                      data-testid={`tx-section-${cur || "none"}`}
                    >
                      <span className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                        {cur ? cur : "No section"}
                      </span>
                    </div>,
                  );
                  prevSection = cur;
                }
              }
              const cat = t.category || (t.direction === "in" ? "income" : "expense");
              nodes.push(
              <div
                key={t.id}
                className={`grid grid-cols-2 ${GRID} gap-3 px-4 py-2.5 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center ${draggingId === t.id ? "opacity-40" : ""}`}
                data-testid="tx-row"
                data-row="data"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={t.sr_no || idx + 1}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (n && n !== t.sr_no) patch(t.id, { sr_no: n });
                    else e.target.value = t.sr_no || idx + 1;
                  }}
                  onKeyDown={advanceOnEnter}
                  className="mm-input-ghost text-xs !py-1.5 w-12 text-center"
                  data-testid="tx-sr-input"
                />
                <input type="date" value={t.date || ""} onChange={(e) => patch(t.id, { date: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" />
                <input list="tx-groups" defaultValue={t.group || ""} onBlur={(e) => patch(t.id, { group: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" placeholder="—" />
                <input list="tx-vendors" defaultValue={t.vendor || t.name || t.company || ""} onBlur={(e) => patch(t.id, { vendor: e.target.value, name: e.target.value, company: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" placeholder="—" />
                <input list="tx-details" defaultValue={t.details || t.notes || ""} onBlur={(e) => patch(t.id, { details: e.target.value, notes: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" placeholder="—" />
                <div className="flex items-center gap-1">
                  <select
                    value={t.currency || "INR"}
                    onChange={(e) => patch(t.id, { currency: e.target.value })}
                    className="mm-input-ghost text-[10px] !py-1 !px-1 w-12"
                    data-testid="tx-currency"
                    title="Currency"
                  >
                    <option value="INR">₹</option>
                    <option value="USD">$</option>
                    <option value="EUR">€</option>
                    <option value="GBP">£</option>
                    <option value="JPY">¥</option>
                    <option value="AED">د.إ</option>
                  </select>
                  <input type="number" defaultValue={t.amount} onBlur={(e) => patch(t.id, { amount: Number(e.target.value) })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs flex-1" />
                </div>
                <input list="tx-modes" defaultValue={t.mode || t.remarks || ""} onBlur={(e) => patch(t.id, { mode: e.target.value, remarks: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" placeholder="—" />
                <input list="tx-heads" defaultValue={t.head || t.expense_head || ""} onBlur={(e) => patch(t.id, { head: e.target.value, expense_head: e.target.value })} onKeyDown={advanceOnEnter} className="mm-input-ghost text-xs" />
                <select
                  value={categoryOptions.includes(cat) ? cat : (cat || "expense")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") {
                      const custom = window.prompt("New category name?", "");
                      if (!custom || !custom.trim()) { e.target.value = cat; return; }
                      const dir = (custom.toLowerCase() === "income" || custom.toLowerCase() === "asset") ? "in" : "out";
                      patch(t.id, { category: custom.trim().toLowerCase(), direction: dir });
                    } else {
                      const dir = (v === "income" || v === "asset") ? "in" : "out";
                      patch(t.id, { category: v, direction: dir });
                    }
                  }}
                  onKeyDown={advanceOnEnter}
                  className="mm-input-ghost text-xs"
                  data-testid="tx-category-select"
                >
                  {!categoryOptions.includes(cat) && cat && (
                    <option key={cat} value={cat}>{cat}</option>
                  )}
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Custom…</option>
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
                  onReminder={() => openReminderFor(t)}
                  onAttach={() => setAttachFor(t)}
                  attachmentCount={(t.attachments || []).length}
                  onFlag={() => patch(t.id, { flagged: !t.flagged })}
                  flagged={!!t.flagged}
                  onDelete={() => remove(t.id)}
                />
              </div>
              );
              // Inline loan-details strip for liability/asset rows: interest_rate · repayment_date · EMI
              const showLoan = (cat === "liability" || cat === "asset")
                || t.interest_rate != null || t.repayment_date || t.emi != null;
              if (showLoan) {
                const startISO = t.date;
                const endISO = t.repayment_date;
                const monthsBetween = (() => {
                  if (!startISO || !endISO) return null;
                  const s = new Date(startISO); const e = new Date(endISO);
                  if (isNaN(s) || isNaN(e) || e <= s) return null;
                  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
                })();
                const calcEmi = (() => {
                  const P = Number(t.amount) || 0;
                  const r = Number(t.interest_rate) || 0;
                  const n = monthsBetween;
                  if (!P || !n || n <= 0) return null;
                  if (!r) return P / n;
                  const i = r / 100 / 12;
                  const pow = Math.pow(1 + i, n);
                  return (P * i * pow) / (pow - 1);
                })();
                nodes.push(
                  <div
                    key={`loan-${t.id}`}
                    className="px-4 py-1.5 border-b border-[rgba(201,169,97,0.08)] bg-[rgba(201,169,97,0.02)]"
                    data-testid="tx-loan-row"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#B7A98A]/70">
                      <span className="uppercase tracking-[0.25em] mm-text-gold/70">Loan</span>
                      <label className="flex items-center gap-1.5">
                        <span>Rate %</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={t.interest_rate ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== (t.interest_rate ?? null)) patch(t.id, { interest_rate: v });
                          }}
                          placeholder="—"
                          className="mm-input-ghost text-[11px] !py-1 w-16"
                          data-testid="tx-interest-rate"
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span>Repay</span>
                        <input
                          type="date"
                          defaultValue={t.repayment_date || ""}
                          onBlur={(e) => {
                            if ((e.target.value || null) !== (t.repayment_date || null)) {
                              patch(t.id, { repayment_date: e.target.value || null });
                            }
                          }}
                          className="mm-input-ghost text-[11px] !py-1"
                          data-testid="tx-repayment-date"
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span>EMI ₹</span>
                        <input
                          type="number"
                          step="1"
                          defaultValue={t.emi ?? (calcEmi ? Math.round(calcEmi) : "")}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== (t.emi ?? null)) patch(t.id, { emi: v });
                          }}
                          placeholder={calcEmi ? String(Math.round(calcEmi)) : "—"}
                          className="mm-input-ghost text-[11px] !py-1 w-24"
                          data-testid="tx-emi"
                          title={calcEmi ? `Auto ₹${Math.round(calcEmi).toLocaleString("en-IN")} over ${monthsBetween} months` : ""}
                        />
                      </label>
                      {calcEmi && (
                        <span className="text-[#B7A98A]/55">
                          auto · ₹{Math.round(calcEmi).toLocaleString("en-IN")} × {monthsBetween}mo
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            });
            return nodes;
          })()
        )}
      </Card>

      <datalist id="tx-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="tx-vendors">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="tx-details">
        {Array.from(new Set(rows.map((r) => r.details || r.notes).filter(Boolean))).map((d) => <option key={d} value={d} />)}
      </datalist>
      <datalist id="tx-modes">
        {Array.from(new Set(["Cash", "Card", "UPI", "Bank", "Cheque", ...rows.map((r) => r.mode || r.remarks).filter(Boolean)])).map((m) => <option key={m} value={m} />)}
      </datalist>
      <datalist id="tx-heads">{heads.map((h) => <option key={h} value={h} />)}</datalist>
      <datalist id="tx-categories">
        {Array.from(new Set([...CATEGORIES, ...rows.map((r) => r.category).filter(Boolean)])).map((c) => <option key={c} value={c} />)}
      </datalist>

      <ReminderDialog open={!!reminderFor} onClose={() => setReminderFor(null)} defaults={reminderFor || {}} />

      <AttachmentsDialog
        open={!!attachFor}
        row={attachFor}
        module="transactions"
        label="Entry"
        onClose={() => setAttachFor(null)}
        onChanged={async (updated) => {
          setAttachFor(updated);
          await load();
        }}
      />
    </div>
  );
}
