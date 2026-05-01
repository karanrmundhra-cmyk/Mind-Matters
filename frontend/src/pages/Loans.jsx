import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Given", "Taken", "Pending", "Closed"];
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState({ name: "", amount: "", interest: 0, status: "Given", reason: "", repayment_date: "" });

  const load = async () => {
    const [l, s] = await Promise.all([api.get("/loans"), api.get("/loans/summary")]);
    setLoans(l.data);
    setSummary(s.data);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.name.trim() || !Number(draft.amount)) return;
    try {
      await api.post("/loans", { ...draft, amount: Number(draft.amount), interest: Number(draft.interest) || 0 });
      setDraft({ name: "", amount: "", interest: 0, status: "Given", reason: "", repayment_date: "" });
      await load();
      toast.success("Loan recorded");
    } catch {
      toast.error("Failed");
    }
  };

  const patch = async (id, body) => {
    await api.patch(`/loans/${id}`, body);
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/loans/${id}`);
    await load();
  };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="loans-page">
      <SectionTitle subtitle="Credit" title="Loan Tracker" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="loan-given" label="Total given" value={fmtINR(summary?.total_given ?? 0)} />
        <Stat testid="loan-taken" label="Total taken" value={fmtINR(summary?.total_taken ?? 0)} />
        <Stat testid="loan-net" label="Net exposure" value={fmtINR(summary?.net_exposure ?? 0)} hint={`${summary?.count ?? 0} record${(summary?.count ?? 0) !== 1 ? "s" : ""}`} />
        <Stat testid="loan-interest" label="Interest accrued" value={fmtINR(summary?.total_interest_accrued ?? 0)} hint={`${summary?.overdue_count ?? 0} overdue`} />
      </div>

      <Card className="p-4" data-testid="loan-add-row">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <input
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mm-input text-sm md:col-span-2"
            data-testid="new-loan-name"
          />
          <input
            type="number"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-loan-amount"
          />
          <input
            type="number"
            placeholder="Interest %"
            value={draft.interest}
            onChange={(e) => setDraft({ ...draft, interest: e.target.value })}
            className="mm-input text-sm"
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="mm-input text-sm"
          >
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input
            type="date"
            value={draft.repayment_date}
            onChange={(e) => setDraft({ ...draft, repayment_date: e.target.value })}
            className="mm-input text-sm"
            title="Repayment date"
          />
          <button
            onClick={add}
            disabled={!draft.name.trim() || !Number(draft.amount)}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
            data-testid="new-loan-submit"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </Card>

      {loans.length === 0 ? (
        <EmptyState title="No loans tracked" hint="Record money given or taken to see net exposure and interest accrual." />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="loans-table">
          <div className="hidden md:grid grid-cols-[50px_110px_1fr_120px_120px_140px_120px_120px_40px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <div>Sr</div><div>Date</div><div>Name</div><div>Amount</div><div>Interest</div><div>Accrued</div><div>Repay by</div><div>Status</div><div />
          </div>
          {loans.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-2 md:grid-cols-[50px_110px_1fr_120px_120px_140px_120px_120px_40px] gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition items-center"
              data-testid="loan-row"
            >
              <div className="text-white/40 text-xs">#{l.sr_no}</div>
              <input
                type="date"
                value={l.date || ""}
                onChange={(e) => patch(l.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <input
                defaultValue={l.name}
                onBlur={(e) => patch(l.id, { name: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                type="number"
                defaultValue={l.amount}
                onBlur={(e) => patch(l.id, { amount: Number(e.target.value) })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                type="number"
                defaultValue={l.interest}
                onBlur={(e) => patch(l.id, { interest: Number(e.target.value) })}
                className="mm-input text-sm !py-1.5"
              />
              <div className="text-sm text-white/75">{fmtINR(l.accrued_interest || 0)}</div>
              <input
                type="date"
                value={l.repayment_date || ""}
                onChange={(e) => patch(l.id, { repayment_date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <select
                value={l.status}
                onChange={(e) => patch(l.id, { status: e.target.value })}
                className="mm-input text-xs !py-1.5"
                data-testid="loan-status-select"
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button
                onClick={() => remove(l.id)}
                className="text-white/40 hover:text-white transition justify-self-end"
                data-testid="loan-delete"
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
