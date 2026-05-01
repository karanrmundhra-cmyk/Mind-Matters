import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TYPES = ["Equity", "FD", "Insurance", "MF", "Bond", "Real Estate", "Gold", "Other"];

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function Investments() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState({
    type: "Equity",
    custom_type: "",
    provider: "",
    amount_invested: "",
    rate_or_value: "",
    start_date: "",
    maturity_date: "",
    notes: "",
  });

  const customTypes = Array.from(new Set(items.map((i) => i.type).filter(Boolean)));
  const allTypes = Array.from(new Set([...DEFAULT_TYPES, ...customTypes]));

  const load = async () => {
    const [i, s] = await Promise.all([api.get("/investments"), api.get("/investments/summary")]);
    setItems(i.data);
    setSummary(s.data);
  };
  useEffect(() => {
    load();
  }, []);

  const insertOne = async (row) => {
    await api.post("/investments", {
      type: row.type || "Equity",
      provider: row.provider || "",
      amount_invested: Number(row.amount_invested) || 0,
      start_date: row.start_date || row.date || null,
      maturity_date: row.maturity_date || null,
      rate_or_value: row.rate_or_value || row.rate || row.value || null,
      notes: row.notes || "",
    });
  };

  const add = async () => {
    const type = draft.type === "__custom__" ? (draft.custom_type || "Other") : draft.type;
    if (!draft.provider.trim() || !Number(draft.amount_invested)) return;
    try {
      await api.post("/investments", {
        type,
        provider: draft.provider,
        amount_invested: Number(draft.amount_invested),
        start_date: draft.start_date || null,
        maturity_date: draft.maturity_date || null,
        rate_or_value: draft.rate_or_value || null,
        notes: draft.notes,
      });
      setDraft({
        type: "Equity",
        custom_type: "",
        provider: "",
        amount_invested: "",
        rate_or_value: "",
        start_date: "",
        maturity_date: "",
        notes: "",
      });
      await load();
      toast.success("Investment added");
    } catch {
      toast.error("Failed");
    }
  };

  const patch = async (id, body) => {
    await api.patch(`/investments/${id}`, body);
    await load();
  };
  const remove = async (id) => {
    await api.delete(`/investments/${id}`);
    await load();
  };

  const describe = (r) =>
    `${r.type || "Equity"} · ${r.provider || "—"} · ₹${Number(r.amount_invested || 0).toLocaleString(
      "en-IN"
    )}${r.rate_or_value ? " · " + r.rate_or_value : ""}${
      r.maturity_date ? " · matures " + r.maturity_date : ""
    }`;

  return (
    <div className="space-y-6 mm-fade-in" data-testid="investments-page">
      <SectionTitle
        subtitle="Portfolio"
        title="Investments & Insurance"
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
        kind="investment"
        placeholder="e.g. SBI FD ₹2,00,000 at 7.1% maturing 15 Aug 2027"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat testid="inv-invested" label="Total invested" value={fmtINR(summary?.total_invested ?? 0)} />
        <Stat
          testid="inv-count"
          label="Holdings"
          value={summary?.count ?? 0}
        />
        <Stat
          testid="inv-maturities"
          label="Upcoming maturities"
          value={summary?.upcoming_maturities?.length ?? 0}
          hint="Next 90 days"
        />
      </div>

      {summary?.upcoming_maturities?.length > 0 && (
        <Card className="p-5" data-testid="maturities-card">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65 mb-3">
            Upcoming maturities
          </div>
          <div className="space-y-2">
            {summary.upcoming_maturities.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-sm border-b border-[rgba(201,169,97,0.1)] pb-2"
              >
                <div className="mm-text-gold-bright">{m.provider}</div>
                <div className="text-[#B7A98A]/75">
                  {m.days} days · {m.maturity_date}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4" data-testid="inv-add-row">
        <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            className="mm-input text-sm"
          >
            {allTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
            <option value="__custom__">+ Custom…</option>
          </select>
          {draft.type === "__custom__" && (
            <input
              placeholder="New head"
              value={draft.custom_type}
              onChange={(e) => setDraft({ ...draft, custom_type: e.target.value })}
              className="mm-input text-sm"
            />
          )}
          <input
            type="date"
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            className="mm-input text-sm"
            placeholder="Date"
          />
          <input
            placeholder="Provider"
            value={draft.provider}
            onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
            className="mm-input text-sm md:col-span-2"
            data-testid="new-inv-provider"
          />
          <input
            type="number"
            placeholder="Amount"
            value={draft.amount_invested}
            onChange={(e) => setDraft({ ...draft, amount_invested: e.target.value })}
            className="mm-input text-sm"
            data-testid="new-inv-amount"
          />
          <input
            placeholder="% or Maturity Value"
            value={draft.rate_or_value}
            onChange={(e) => setDraft({ ...draft, rate_or_value: e.target.value })}
            className="mm-input text-sm md:col-span-2"
          />
          <input
            type="date"
            value={draft.maturity_date}
            onChange={(e) => setDraft({ ...draft, maturity_date: e.target.value })}
            className="mm-input text-sm"
            placeholder="Maturity"
          />
          <button
            onClick={add}
            disabled={!draft.provider.trim() || !Number(draft.amount_invested)}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 md:col-span-8"
            data-testid="new-inv-submit"
          >
            <Plus size={14} /> Add holding
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="No investments tracked"
          hint="Add via AI bar, the row above, or paste a list via Bulk add. Custom heads supported."
        />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="inv-table">
          <div className="hidden md:grid grid-cols-[60px_120px_110px_1.4fr_120px_1fr_120px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.18)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60">
            <div>Sr Number</div>
            <div>Type</div>
            <div>Date</div>
            <div>Provider</div>
            <div>Amount</div>
            <div>% or Maturity Value</div>
            <div>Maturity</div>
            <div />
          </div>
          {items.map((i) => (
            <div
              key={i.id}
              className="grid grid-cols-2 md:grid-cols-[60px_120px_110px_1.4fr_120px_1fr_120px_40px] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center"
              data-testid="inv-row"
            >
              <div className="mm-text-gold/80 text-xs">#{i.sr_no}</div>
              <input
                defaultValue={i.type}
                onBlur={(e) => patch(i.id, { type: e.target.value })}
                className="mm-input text-xs !py-1.5"
                list="inv-types"
              />
              <input
                type="date"
                value={i.start_date || ""}
                onChange={(e) => patch(i.id, { start_date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <input
                defaultValue={i.provider}
                onBlur={(e) => patch(i.id, { provider: e.target.value })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                type="number"
                defaultValue={i.amount_invested}
                onBlur={(e) => patch(i.id, { amount_invested: Number(e.target.value) })}
                className="mm-input text-sm !py-1.5"
              />
              <input
                defaultValue={i.rate_or_value || ""}
                onBlur={(e) => patch(i.id, { rate_or_value: e.target.value })}
                placeholder="—"
                className="mm-input text-sm !py-1.5"
              />
              <input
                type="date"
                value={i.maturity_date || ""}
                onChange={(e) => patch(i.id, { maturity_date: e.target.value })}
                className="mm-input text-xs !py-1.5"
              />
              <button
                onClick={() => remove(i.id)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                data-testid="inv-delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <datalist id="inv-types">
            {allTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Card>
      )}

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="investment"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
