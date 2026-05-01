import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import { Upload, Plus, Trash2, ArrowUpRight, ArrowDownLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const monthStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function CashFlow() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(monthStr());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const [draft, setDraft] = useState({
    amount: "", mode: "Bank", expense_head: "", company: "", direction: "out", notes: "",
  });

  const load = async () => {
    const [t, s] = await Promise.all([
      api.get("/transactions", { params: { month } }),
      api.get("/transactions/summary", { params: { month } }),
    ]);
    setTransactions(t.data);
    setSummary(s.data);
  };

  useEffect(() => { load(); }, [month]);

  const add = async () => {
    if (!Number(draft.amount)) return;
    try {
      await api.post("/transactions", { ...draft, amount: Number(draft.amount) });
      setDraft({ amount: "", mode: "Bank", expense_head: "", company: "", direction: "out", notes: "" });
      await load();
      toast.success("Transaction added");
    } catch { toast.error("Failed"); }
  };

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("account", "Personal");
    setUploading(true);
    try {
      const { data } = await api.post("/transactions/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`AI imported ${data.inserted} transactions`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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

  return (
    <div className="space-y-6 mm-fade-in" data-testid="cashflow-page">
      <SectionTitle
        subtitle="AI Accountant"
        title="Cash Flow"
        right={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mm-input max-w-[160px] text-sm"
            data-testid="cashflow-month"
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="cf-out" label="Expenses" value={fmtINR(summary?.total_out ?? 0)} hint={`${summary?.count ?? 0} entries`} />
        <Stat testid="cf-in" label="Income" value={fmtINR(summary?.total_in ?? 0)} />
        <Stat testid="cf-net" label="Net" value={fmtINR(summary?.net ?? 0)} />
        <Stat testid="cf-change" label="vs last month"
          value={summary?.change_vs_prev_month_percent != null ? `${summary.change_vs_prev_month_percent > 0 ? "+" : ""}${summary.change_vs_prev_month_percent}%` : "—"}
          hint="Expense delta"
        />
      </div>

      {/* Top heads */}
      {summary?.top_expense_heads?.length > 0 && (
        <Card className="p-5" data-testid="top-heads">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60 mb-4">
            Top expense heads
          </div>
          <div className="space-y-3">
            {summary.top_expense_heads.map((h, i) => {
              const max = summary.top_expense_heads[0].amount || 1;
              const w = Math.round((h.amount / max) * 100);
              return (
                <div key={h.head} className="flex items-center gap-4">
                  <div className="w-32 text-sm">{h.head}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-white/70" style={{ width: `${w}%`, transition: "width 400ms ease" }} />
                  </div>
                  <div className="w-28 text-right text-sm text-white/80">{fmtINR(h.amount)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Upload + manual add */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1" data-testid="upload-card">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60 mb-2 flex items-center gap-2">
            <Sparkles size={12} /> AI upload
          </div>
          <div className="text-xs text-white/50 mb-4">
            Drop a bank statement (Excel/CSV/PDF). Gemini 3 Flash reads and categorises each line.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={(e) => upload(e.target.files?.[0])}
            className="hidden"
            data-testid="upload-input"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mm-btn-ghost w-full text-sm flex items-center justify-center gap-2"
            data-testid="upload-btn"
          >
            <Upload size={14} /> {uploading ? "AI parsing…" : "Upload & auto-categorize"}
          </button>
        </Card>

        <Card className="p-5 lg:col-span-2" data-testid="manual-add">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60 mb-4">Manual entry</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <select
              value={draft.direction}
              onChange={(e) => setDraft({ ...draft, direction: e.target.value })}
              className="mm-input text-sm"
            >
              <option value="out">Expense</option>
              <option value="in">Income</option>
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              className="mm-input text-sm"
              data-testid="new-tx-amount"
            />
            <input
              placeholder="Head"
              value={draft.expense_head}
              onChange={(e) => setDraft({ ...draft, expense_head: e.target.value })}
              className="mm-input text-sm"
            />
            <input
              placeholder="Company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              className="mm-input text-sm"
            />
            <input
              placeholder="Mode"
              value={draft.mode}
              onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
              className="mm-input text-sm"
            />
            <button
              onClick={add}
              disabled={!Number(draft.amount)}
              className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
              data-testid="new-tx-submit"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </Card>
      </div>

      {/* List */}
      {transactions.length === 0 ? (
        <EmptyState title="No transactions this month" hint="Upload a statement or add manually." />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="tx-table">
          <div className="hidden md:grid grid-cols-[90px_40px_110px_1fr_1fr_120px_100px_40px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <div>Date</div><div /><div>Amount</div><div>Head</div><div>Company</div><div>Mode</div><div>Source</div><div />
          </div>
          {transactions.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-2 md:grid-cols-[90px_40px_110px_1fr_1fr_120px_100px_40px] gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition items-center"
              data-testid="tx-row"
            >
              <input
                type="date"
                value={t.date || ""}
                onChange={(e) => patch(t.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <div className="text-white/60">
                {t.direction === "in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              </div>
              <input
                type="number"
                defaultValue={t.amount}
                onBlur={(e) => patch(t.id, { amount: Number(e.target.value) })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.expense_head}
                onBlur={(e) => patch(t.id, { expense_head: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.company}
                onBlur={(e) => patch(t.id, { company: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={t.mode}
                onBlur={(e) => patch(t.id, { mode: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                {t.source}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-white/40 hover:text-white transition justify-self-end"
                data-testid="tx-delete"
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
