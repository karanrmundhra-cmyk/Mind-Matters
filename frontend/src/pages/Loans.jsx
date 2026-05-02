import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const STATUSES = ["Given", "Taken", "Pending", "Closed"];
const INTEREST_TYPES = ["percent", "fixed"];
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const LOAN_COLUMNS = [
  { key: "date", label: "Date", type: "date", width: "120px" },
  { key: "name", label: "Name", type: "text", width: "1fr" },
  { key: "amount", label: "Amount", type: "number", width: "110px" },
  { key: "interest", label: "Interest", type: "number", width: "100px" },
  { key: "interest_type", label: "Type", type: "select", options: INTEREST_TYPES, width: "100px" },
  { key: "reason", label: "Details", type: "text", width: "1fr" },
  { key: "repayment_date", label: "Repay by", type: "date", width: "120px" },
  { key: "status", label: "Status", type: "select", options: STATUSES, width: "100px" },
];

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    amount: "",
    interest: 0,
    interest_type: "percent",
    status: "Given",
    reason: "",
    date: "",
    repayment_date: "",
  });

  const load = async () => {
    const [l, s] = await Promise.all([api.get("/loans"), api.get("/loans/summary")]);
    setLoans(l.data);
    setSummary(s.data);
  };
  useEffect(() => {
    load();
  }, []);

  const insertOne = async (row) => {
    await api.post("/loans", {
      name: capWords(row.name || ""),
      amount: Number(row.amount) || 0,
      interest: Number(row.interest) || 0,
      interest_type: row.interest_type === "fixed" ? "fixed" : "percent",
      status: row.status || "Given",
      reason: capWords(row.reason || ""),
      date: row.date || null,
      repayment_date: row.repayment_date || null,
    });
  };

  const add = async () => {
    if (!draft.name.trim() || !Number(draft.amount)) return;
    try {
      await api.post("/loans", {
        ...draft,
        name: capWords(draft.name),
        reason: capWords(draft.reason),
        amount: Number(draft.amount),
        interest: Number(draft.interest) || 0,
      });
      setDraft({
        name: "",
        amount: "",
        interest: 0,
        interest_type: "percent",
        status: "Given",
        reason: "",
        date: "",
        repayment_date: "",
      });
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

  const describe = (r) =>
    `${r.status || "Given"} · ${r.name || "—"} · ₹${Number(r.amount || 0).toLocaleString("en-IN")} @ ${
      r.interest || 0
    }%${r.date ? " · " + r.date : ""}${r.reason ? " · " + r.reason : ""}`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="loans-page">
      <SectionTitle
        subtitle="Credit"
        title="Loan Tracker"
        right={
          <button
            onClick={() => setBulkOpen(true)}
            className="mm-btn-ghost text-xs flex items-center gap-1.5"
            data-testid="bulk-add-open"
          >
            <Upload size={12} /> Bulk add
          </button>
        }
      />

      <AiAddBar
        kind="loan"
        placeholder="e.g. Lent Brinda 50000 at 9% on 1 Jan, repayment 30 Jun"
        columns={LOAN_COLUMNS}
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="loan-given" label="Total given" value={fmtINR(summary?.total_given ?? 0)} />
        <Stat testid="loan-taken" label="Total taken" value={fmtINR(summary?.total_taken ?? 0)} />
        <Stat
          testid="loan-net"
          label="Net exposure"
          value={fmtINR(summary?.net_exposure ?? 0)}
          hint={`${summary?.count ?? 0} record${(summary?.count ?? 0) !== 1 ? "s" : ""}`}
        />
        <Stat
          testid="loan-interest"
          label="Interest accrued"
          value={fmtINR(summary?.total_interest_accrued ?? 0)}
          hint={`${summary?.overdue_count ?? 0} overdue`}
        />
      </div>

      <Card className="p-4" data-testid="loan-add-row">
        <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="mm-input text-sm"
            placeholder="Date"
          />
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
            placeholder={draft.interest_type === "fixed" ? "Interest ₹" : "Interest %"}
            value={draft.interest}
            onChange={(e) => setDraft({ ...draft, interest: e.target.value })}
            className="mm-input text-sm"
          />
          <select
            value={draft.interest_type}
            onChange={(e) => setDraft({ ...draft, interest_type: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-loan-interest-type"
            title="Interest type"
          >
            <option value="percent">% rate</option>
            <option value="fixed">Fixed ₹</option>
          </select>
          <input
            placeholder="Details / reason"
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            className="mm-input text-sm md:col-span-2"
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="mm-input text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="date"
            value={draft.repayment_date}
            onChange={(e) => setDraft({ ...draft, repayment_date: e.target.value })}
            className="mm-input text-sm"
            placeholder="Repay by"
            title="Repayment date"
          />
          <button
            onClick={add}
            disabled={!draft.name.trim() || !Number(draft.amount)}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 md:col-span-8"
            data-testid="new-loan-submit"
          >
            <Plus size={14} /> Add loan
          </button>
        </div>
      </Card>

      {loans.length === 0 ? (
        <EmptyState
          title="No loans tracked"
          hint="Add via AI bar, the row above, or paste a list via Bulk add."
        />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="loans-table">
          <div className="hidden md:grid grid-cols-[50px_110px_1fr_120px_100px_90px_1fr_120px_100px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.18)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60">
            <div>Sr</div>
            <div>Date</div>
            <div>Name</div>
            <div>Amount</div>
            <div>Interest</div>
            <div>Type</div>
            <div>Details</div>
            <div>Repay by</div>
            <div>Status</div>
            <div />
          </div>
          {loans.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-2 md:grid-cols-[50px_110px_1fr_120px_100px_90px_1fr_120px_100px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center"
              data-testid="loan-row"
            >
              <div className="mm-text-gold/80 text-xs">#{l.sr_no}</div>
              <input
                type="date"
                value={l.date || ""}
                onChange={(e) => patch(l.id, { date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <input
                defaultValue={l.name}
                onBlur={(e) => patch(l.id, { name: capWords(e.target.value) })}
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
                title={(l.interest_type || "percent") === "fixed" ? "Fixed ₹" : "% rate"}
              />
              <select
                value={l.interest_type || "percent"}
                onChange={(e) => patch(l.id, { interest_type: e.target.value })}
                className="mm-input text-xs !py-1.5"
                data-testid="loan-interest-type"
              >
                <option value="percent">%</option>
                <option value="fixed">Fixed ₹</option>
              </select>
              <input
                defaultValue={l.reason || ""}
                onBlur={(e) => patch(l.id, { reason: capWords(e.target.value) })}
                placeholder="—"
                className="mm-input text-sm !py-1.5"
              />
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
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => remove(l.id)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                data-testid="loan-delete"
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
        kind="loan"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
