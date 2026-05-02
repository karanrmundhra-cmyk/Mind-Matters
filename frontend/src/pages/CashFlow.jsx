import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Upload, ArrowUpRight, ArrowDownLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const monthStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const TX_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "120px" },
  { key: "direction", label: "Dir", type: "select", options: ["out", "in"], width: "80px" },
  { key: "amount", label: "Amount", type: "number", width: "110px" },
  { key: "notes", label: "Details", type: "text", width: "1.4fr" },
  { key: "company", label: "Company", type: "text", width: "1fr" },
  { key: "expense_head", label: "Head", type: "text", width: "120px" },
  { key: "mode", label: "Mode", type: "select",
    options: ["Bank", "Card", "Cash", "UPI", "Cheque"], width: "100px" },
];

export default function CashFlow() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(monthStr());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [stmtFile, setStmtFile] = useState(null);
  const [duplicates, setDuplicates] = useState([]); // pending duplicates from upload
  const [stmtBusy, setStmtBusy] = useState(false);
  const stmtRef = React.useRef(null);

  const [draft, setDraft] = useState({
    date: "",
    amount: "",
    notes: "",
    company: "",
    expense_head: "",
    direction: "out",
    mode: "Bank",
  });

  const load = async () => {
    const [t, s] = await Promise.all([
      api.get("/transactions", { params: { month } }),
      api.get("/transactions/summary", { params: { month } }),
    ]);
    setTransactions(t.data);
    setSummary(s.data);
  };
  useEffect(() => {
    load();
  }, [month]);

  const insertOne = async (row) => {
    await api.post("/transactions", {
      date: row.date || null,
      amount: Number(row.amount) || 0,
      notes: capWords(row.notes || row.details || ""),
      company: capWords(row.company || ""),
      expense_head: capWords(row.expense_head || "Uncategorized"),
      direction: row.direction || "out",
      mode: capWords(row.mode || "Bank"),
    });
  };

  // AI auto-categorize the head when user provides only a description
  const autoFillHead = async () => {
    if (!draft.notes && !draft.company) return;
    try {
      const { data } = await api.post("/parse/bulk", {
        kind: "expense",
        text: `${draft.date || ""} ${draft.amount || ""} ${draft.notes || ""} ${draft.company || ""}`.trim(),
      });
      const r = data.rows?.[0];
      if (r) {
        setDraft((d) => ({
          ...d,
          expense_head: d.expense_head || r.expense_head || "Uncategorized",
          company: d.company || r.company || "",
          direction: d.direction || r.direction || "out",
          mode: d.mode || r.mode || "Bank",
        }));
        toast.success("AI auto-filled fields");
      }
    } catch {}
  };

  const add = async () => {
    if (!Number(draft.amount)) return;
    try {
      // if no head, ask AI quickly (silent)
      let head = draft.expense_head;
      if (!head || head === "Uncategorized") {
        try {
          const { data } = await api.post("/parse/bulk", {
            kind: "expense",
            text: `${draft.date || ""} ${draft.amount} ${draft.notes || ""} ${draft.company || ""}`.trim(),
          });
          head = data.rows?.[0]?.expense_head || "Uncategorized";
        } catch {}
      }
      await api.post("/transactions", {
        ...draft,
        amount: Number(draft.amount),
        notes: capWords(draft.notes),
        company: capWords(draft.company),
        expense_head: capWords(head),
      });
      setDraft({
        date: "",
        amount: "",
        notes: "",
        company: "",
        expense_head: "",
        direction: "out",
        mode: "Bank",
      });
      await load();
      toast.success("Transaction added");
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

  // Upload bank statement (.xlsx / .csv / .pdf) — triggers duplicate detection
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
      const dupCount = data.duplicate_count || 0;
      const newCount = data.inserted || 0;
      if (newCount) toast.success(`${newCount} new transaction${newCount !== 1 ? "s" : ""} added`);
      if (dupCount) {
        toast(`${dupCount} possible duplicate${dupCount !== 1 ? "s" : ""} — review below`);
        setDuplicates(data.duplicates || []);
      } else if (!newCount) {
        toast.error("Nothing parsed — try a different file format.");
      }
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setStmtBusy(false);
      if (stmtRef.current) stmtRef.current.value = "";
    }
  };

  const keepDup = async (idx) => {
    const d = duplicates[idx];
    if (!d) return;
    try {
      const payload = {
        date: d.date,
        amount: d.amount,
        notes: d.notes,
        company: d.company,
        expense_head: d.expense_head,
        direction: d.direction,
        mode: d.mode,
      };
      await api.post("/transactions", payload);
      setDuplicates((arr) => arr.filter((_, i) => i !== idx));
      toast.success("Added");
      await load();
    } catch {
      toast.error("Failed to add");
    }
  };
  const skipDup = (idx) => setDuplicates((arr) => arr.filter((_, i) => i !== idx));

  const describe = (r) =>
    `${r.date || ""} · ${r.direction === "in" ? "+" : "-"}₹${Number(r.amount || 0).toLocaleString(
      "en-IN"
    )} · ${r.expense_head || "Uncategorized"}${r.company ? " · " + r.company : ""}${
      r.notes ? " · " + r.notes : ""
    }`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="cashflow-page">
      <SectionTitle
        subtitle="AI Accountant"
        title="Cash Flow"
        right={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mm-input max-w-[160px] text-sm"
              data-testid="cashflow-month"
            />
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
              title="Upload bank statement (.xlsx / .csv / .pdf) — duplicates will be flagged"
            >
              <Upload size={12} /> {stmtBusy ? "Reading…" : "Upload statement"}
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

      <AiAddBar
        kind="expense"
        placeholder="e.g. 450 coffee at Starbucks · 12000 office rent paid via NEFT"
        columns={TX_COLUMNS}
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      {/* Duplicate confirmation block from bank-statement upload */}
      {duplicates.length > 0 && (
        <Card className="p-0 overflow-hidden border-[#C9A961]/40" data-testid="duplicates-review">
          <div className="px-5 py-3 border-b border-[rgba(201,169,97,0.18)] flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                {duplicates.length} possible duplicate{duplicates.length !== 1 ? "s" : ""} from upload
              </div>
              <div className="text-xs text-[#B7A98A]/65 mt-1">
                Each row matches an existing transaction (same date, amount, company). Review one-by-one.
              </div>
            </div>
            <button
              onClick={() => setDuplicates([])}
              className="mm-btn-ghost text-xs"
              data-testid="dup-discard-all"
            >
              Discard all
            </button>
          </div>
          {duplicates.map((d, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-[110px_90px_120px_1.4fr_1fr_120px_180px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] items-center"
              data-testid="dup-row"
            >
              <div className="text-xs text-[#B7A98A]/75">{d.date}</div>
              <div className={`text-xs font-medium ${d.direction === "in" ? "text-emerald-300" : "mm-text-gold-bright"}`}>
                {d.direction === "in" ? "+" : "-"}
                {fmtINR(d.amount)}
              </div>
              <div className="text-xs">{d.expense_head}</div>
              <div className="text-xs text-[#B7A98A]/85 truncate" title={d.notes}>{d.notes || "—"}</div>
              <div className="text-xs text-[#B7A98A]/65 truncate">{d.company || "—"}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55">
                {d.mode}
              </div>
              <div className="flex items-center gap-2 justify-self-end">
                <button
                  onClick={() => skipDup(idx)}
                  className="mm-btn-ghost text-xs flex items-center gap-1"
                  data-testid="dup-skip"
                >
                  <X size={12} /> Skip
                </button>
                <button
                  onClick={() => keepDup(idx)}
                  className="mm-btn-primary text-xs flex items-center gap-1"
                  data-testid="dup-keep"
                >
                  <Check size={12} /> Keep
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          testid="cf-out"
          label="Expenses"
          value={fmtINR(summary?.total_out ?? 0)}
          hint={`${summary?.count ?? 0} entries`}
        />
        <Stat testid="cf-in" label="Income" value={fmtINR(summary?.total_in ?? 0)} />
        <Stat testid="cf-net" label="Net" value={fmtINR(summary?.net ?? 0)} />
        <Stat
          testid="cf-change"
          label="vs last month"
          value={
            summary?.change_vs_prev_month_percent != null
              ? `${summary.change_vs_prev_month_percent > 0 ? "+" : ""}${summary.change_vs_prev_month_percent}%`
              : "—"
          }
          hint="Expense delta"
        />
      </div>

      {summary?.top_expense_heads?.length > 0 && (
        <Card className="p-5" data-testid="top-heads">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-4">
            Top expense heads
          </div>
          <div className="space-y-3">
            {summary.top_expense_heads.map((h, i) => {
              const max = summary.top_expense_heads[0].amount || 1;
              const w = Math.round((h.amount / max) * 100);
              return (
                <div key={h.head} className="flex items-center gap-4">
                  <div className="w-32 text-sm">{h.head}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-[rgba(201,169,97,0.12)] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#E4C98C] to-[#C9A961]"
                      style={{ width: `${w}%`, transition: "width 400ms ease" }}
                    />
                  </div>
                  <div className="w-28 text-right text-sm mm-text-gold-bright">
                    {fmtINR(h.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Manual entry */}
      <Card className="p-5" data-testid="manual-add">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-4">
          Manual entry — AI auto-categorises into a personal balance-sheet head
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="mm-input text-sm"
          />
          <input
            type="number"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-tx-amount"
          />
          <input
            placeholder="Details"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="mm-input text-sm md:col-span-2"
          />
          <input
            placeholder="Company"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            className="mm-input text-sm"
          />
          <input
            placeholder="Head (auto)"
            value={draft.expense_head}
            onChange={(e) => setDraft({ ...draft, expense_head: e.target.value })}
            className="mm-input text-sm"
          />
          <select
            value={draft.direction}
            onChange={(e) => setDraft({ ...draft, direction: e.target.value })}
            className="mm-input text-sm"
          >
            <option value="out">Expense</option>
            <option value="in">Income</option>
          </select>
          <button
            onClick={autoFillHead}
            className="mm-btn-ghost text-xs"
            data-testid="autofill-head"
          >
            ✨ Auto-fill
          </button>
          <button
            onClick={add}
            disabled={!Number(draft.amount)}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 md:col-span-6"
            data-testid="new-tx-submit"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </Card>

      {/* List */}
      {transactions.length === 0 ? (
        <EmptyState
          title="No transactions this month"
          hint="Type into the AI bar, fill the manual row, paste rows via Bulk add, or send your bot a Telegram message."
        />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="tx-table">
          <div className="hidden md:grid grid-cols-[100px_50px_120px_1.4fr_1fr_140px_100px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.18)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60">
            <div>Date</div>
            <div />
            <div>Amount</div>
            <div>Details</div>
            <div>Company</div>
            <div>Head</div>
            <div>Source</div>
            <div />
          </div>
          {transactions.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-2 md:grid-cols-[100px_50px_120px_1.4fr_1fr_140px_100px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center"
              data-testid="tx-row"
            >
              <input
                type="date"
                value={t.date || ""}
                onChange={(e) => patch(t.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <div className="mm-text-gold/75">
                {t.direction === "in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              </div>
              <input
                type="number"
                defaultValue={t.amount}
                onBlur={(e) => patch(t.id, { amount: Number(e.target.value) })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.notes || ""}
                onBlur={(e) => patch(t.id, { notes: e.target.value })}
                placeholder="—"
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.company || ""}
                onBlur={(e) => patch(t.id, { company: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.expense_head || ""}
                onBlur={(e) => patch(t.id, { expense_head: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55">
                {t.source}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                data-testid="tx-delete"
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
        kind="expense"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
