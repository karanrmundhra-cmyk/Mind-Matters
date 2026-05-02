import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import { Plus, Trash2, Upload, TrendingUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { capWords } from "@/lib/format";

const INV_TYPES = ["Equity", "FD", "MF", "Bond", "Real Estate", "Gold", "Other"];
const INS_TYPES = ["Term Life", "Whole Life", "Health", "ULIP", "Vehicle", "Travel", "Other"];
const INSURED_FOR = ["Self", "Wife", "Husband", "Mother", "Father", "Children", "Family", "Medical", "Other"];

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

// AI confirmation columns
const INV_COLUMNS = [
  { key: "kind", label: "Kind", type: "select", options: ["investment", "insurance"], width: "120px" },
  { key: "type", label: "Type", type: "text", width: "120px" },
  { key: "start_date", label: "Date", type: "date", width: "120px" },
  { key: "provider", label: "Provider", type: "text", width: "1.2fr" },
  { key: "amount_invested", label: "Amount", type: "number", width: "120px" },
  { key: "rate_or_value", label: "% / Maturity", type: "text", width: "1fr" },
  { key: "maturity_date", label: "Maturity", type: "date", width: "120px" },
  { key: "insured_for", label: "Insured For", type: "text", width: "120px" },
];

export default function Investments() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tab, setTab] = useState("investment"); // 'investment' | 'insurance'
  const [draft, setDraft] = useState({
    kind: "investment",
    type: "Equity",
    custom_type: "",
    provider: "",
    amount_invested: "",
    rate_or_value: "",
    start_date: "",
    maturity_date: "",
    insured_for: "",
    notes: "",
  });

  // change kind toggle on draft
  const setKind = (k) =>
    setDraft((d) => ({
      ...d,
      kind: k,
      type: k === "insurance" ? "Term Life" : "Equity",
    }));

  const customTypes = useMemo(() => Array.from(new Set(items.map((i) => i.type).filter(Boolean))), [items]);
  const allTypes = useMemo(() => {
    const base = draft.kind === "insurance" ? INS_TYPES : INV_TYPES;
    return Array.from(new Set([...base, ...customTypes]));
  }, [draft.kind, customTypes]);

  const load = async () => {
    const [i, s] = await Promise.all([api.get("/investments"), api.get("/investments/summary")]);
    setItems(i.data);
    setSummary(s.data);
  };
  useEffect(() => {
    load();
  }, []);

  // tab-filtered list
  const tabItems = useMemo(
    () => items.filter((i) => (i.kind || "investment") === tab),
    [items, tab]
  );
  const totalForTab = useMemo(
    () => tabItems.reduce((s, i) => s + Number(i.amount_invested || 0), 0),
    [tabItems]
  );
  const investmentCount = items.filter((i) => (i.kind || "investment") === "investment").length;
  const insuranceCount = items.filter((i) => i.kind === "insurance").length;

  const insertOne = async (row) => {
    const kind = row.kind === "insurance" ? "insurance" : "investment";
    await api.post("/investments", {
      kind,
      type: capWords(row.type || (kind === "insurance" ? "Term Life" : "Equity")),
      provider: capWords(row.provider || ""),
      amount_invested: Number(row.amount_invested) || 0,
      start_date: row.start_date || row.date || null,
      maturity_date: row.maturity_date || null,
      rate_or_value: row.rate_or_value || row.rate || row.value || null,
      insured_for: kind === "insurance" ? capWords(row.insured_for || "") : null,
      notes: capWords(row.notes || ""),
    });
  };

  const add = async () => {
    const type = draft.type === "__custom__" ? capWords(draft.custom_type || "Other") : draft.type;
    if (!draft.provider.trim() || !Number(draft.amount_invested)) return;
    try {
      await api.post("/investments", {
        kind: draft.kind,
        type,
        provider: capWords(draft.provider),
        amount_invested: Number(draft.amount_invested),
        start_date: draft.start_date || null,
        maturity_date: draft.maturity_date || null,
        rate_or_value: draft.rate_or_value || null,
        insured_for: draft.kind === "insurance" ? capWords(draft.insured_for || "") : null,
        notes: capWords(draft.notes || ""),
      });
      setDraft({
        kind: draft.kind,
        type: draft.kind === "insurance" ? "Term Life" : "Equity",
        custom_type: "",
        provider: "",
        amount_invested: "",
        rate_or_value: "",
        start_date: "",
        maturity_date: "",
        insured_for: "",
        notes: "",
      });
      await load();
      toast.success(`${draft.kind === "insurance" ? "Insurance policy" : "Investment"} added`);
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
    `${r.kind === "insurance" ? "Insurance" : r.type || "Equity"} · ${r.provider || "—"} · ₹${Number(
      r.amount_invested || 0
    ).toLocaleString("en-IN")}${r.rate_or_value ? " · " + r.rate_or_value : ""}${
      r.insured_for ? " · for " + r.insured_for : ""
    }${r.maturity_date ? " · matures " + r.maturity_date : ""}`;

  const isInsurance = tab === "insurance";

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
        placeholder="e.g. SBI FD ₹2,00,000 at 7.1% maturing 15 Aug 2027 · or LIC term plan ₹50k yearly for wife"
        columns={INV_COLUMNS}
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      {/* Tab switcher */}
      <div className="flex gap-2" data-testid="inv-tabs">
        <button
          onClick={() => setTab("investment")}
          className={`flex-1 px-4 py-3 rounded-xl border transition text-left ${
            tab === "investment"
              ? "border-[#C9A961] bg-[rgba(201,169,97,0.08)] mm-text-gold-bright"
              : "border-[rgba(201,169,97,0.18)] text-[#B7A98A]/65 hover:border-[#C9A961]/50"
          }`}
          data-testid="tab-investment"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] mb-1">
            <TrendingUp size={11} /> Investments
          </div>
          <div className="mm-font-display text-xl">{fmtINR(summary?.total_invested ?? 0)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55 mt-1">
            {investmentCount} holding{investmentCount !== 1 ? "s" : ""}
          </div>
        </button>
        <button
          onClick={() => setTab("insurance")}
          className={`flex-1 px-4 py-3 rounded-xl border transition text-left ${
            tab === "insurance"
              ? "border-[#C9A961] bg-[rgba(201,169,97,0.08)] mm-text-gold-bright"
              : "border-[rgba(201,169,97,0.18)] text-[#B7A98A]/65 hover:border-[#C9A961]/50"
          }`}
          data-testid="tab-insurance"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] mb-1">
            <Shield size={11} /> Insurance
          </div>
          <div className="mm-font-display text-xl">{fmtINR(summary?.total_insurance ?? 0)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/55 mt-1">
            {insuranceCount} polic{insuranceCount === 1 ? "y" : "ies"}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat
          testid="inv-tab-total"
          label={`Total ${isInsurance ? "Insurance Premium" : "Invested"}`}
          value={fmtINR(totalForTab)}
        />
        <Stat testid="inv-tab-count" label={isInsurance ? "Policies" : "Holdings"} value={tabItems.length} />
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

      {/* Manual add row */}
      <Card className="p-4" data-testid="inv-add-row">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setKind("investment")}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              draft.kind === "investment"
                ? "border-[#C9A961] mm-text-gold-bright bg-[rgba(201,169,97,0.06)]"
                : "border-[rgba(201,169,97,0.2)] text-[#B7A98A]/60"
            }`}
            data-testid="draft-kind-investment"
          >
            Investment
          </button>
          <button
            onClick={() => setKind("insurance")}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              draft.kind === "insurance"
                ? "border-[#C9A961] mm-text-gold-bright bg-[rgba(201,169,97,0.06)]"
                : "border-[rgba(201,169,97,0.2)] text-[#B7A98A]/60"
            }`}
            data-testid="draft-kind-insurance"
          >
            Insurance
          </button>
        </div>
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
            placeholder={draft.kind === "insurance" ? "Sum assured / premium" : "% or maturity value"}
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
          {draft.kind === "insurance" && (
            <input
              placeholder="Insured for (e.g. Wife, Mother, Medical)"
              value={draft.insured_for}
              onChange={(e) => setDraft({ ...draft, insured_for: e.target.value })}
              list="insured-for-list"
              className="mm-input text-sm md:col-span-3"
              data-testid="new-inv-insured-for"
            />
          )}
          <button
            onClick={add}
            disabled={!draft.provider.trim() || !Number(draft.amount_invested)}
            className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 md:col-span-8"
            data-testid="new-inv-submit"
          >
            <Plus size={14} /> Add {draft.kind === "insurance" ? "policy" : "holding"}
          </button>
        </div>
        <datalist id="insured-for-list">
          {INSURED_FOR.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </Card>

      {/* Tab-filtered table */}
      {tabItems.length === 0 ? (
        <EmptyState
          title={`No ${isInsurance ? "insurance policies" : "investments"} yet`}
          hint="Add via AI bar, the row above, or paste a list via Bulk add."
        />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid={isInsurance ? "ins-table" : "inv-table"}>
          <div
            className={`hidden md:grid ${
              isInsurance
                ? "grid-cols-[60px_120px_110px_1.2fr_120px_1fr_120px_140px_40px]"
                : "grid-cols-[60px_120px_110px_1.4fr_120px_1fr_120px_40px]"
            } gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.18)] text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/60`}
          >
            <div>Sr</div>
            <div>Type</div>
            <div>Date</div>
            <div>Provider</div>
            <div>Amount</div>
            <div>{isInsurance ? "Sum Assured" : "% / Maturity Value"}</div>
            <div>Maturity</div>
            {isInsurance && <div>Insured For</div>}
            <div />
          </div>
          {tabItems.map((i) => (
            <div
              key={i.id}
              className={`grid grid-cols-2 md:${
                isInsurance
                  ? "grid-cols-[60px_120px_110px_1.2fr_120px_1fr_120px_140px_40px]"
                  : "grid-cols-[60px_120px_110px_1.4fr_120px_1fr_120px_40px]"
              } gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] hover:bg-[rgba(201,169,97,0.04)] items-center`}
              data-testid={isInsurance ? "ins-row" : "inv-row"}
            >
              <div className="mm-text-gold/80 text-xs">#{i.sr_no}</div>
              <input
                defaultValue={i.type}
                onBlur={(e) => patch(i.id, { type: capWords(e.target.value) })}
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
                onBlur={(e) => patch(i.id, { provider: capWords(e.target.value) })}
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
              {isInsurance && (
                <input
                  defaultValue={i.insured_for || ""}
                  onBlur={(e) => patch(i.id, { insured_for: capWords(e.target.value) })}
                  list="insured-for-list"
                  placeholder="—"
                  className="mm-input text-sm !py-1.5"
                  data-testid="row-insured-for"
                />
              )}
              <button
                onClick={() => remove(i.id)}
                className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition justify-self-end"
                data-testid={isInsurance ? "ins-delete" : "inv-delete"}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <datalist id="inv-types">
            {[...INV_TYPES, ...INS_TYPES, ...customTypes].map((t) => (
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
