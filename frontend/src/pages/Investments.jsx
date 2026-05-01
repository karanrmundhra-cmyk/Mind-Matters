import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState, Stat } from "@/components/Primitives";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["Insurance", "Equity", "MF", "FD", "Other"];
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

// monochrome pie (svg) using cumulative arcs
function MonochromePie({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  let cumulative = 0;
  const shades = ["#ffffff", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46"];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {data.map((d, i) => {
        const start = cumulative / total;
        cumulative += d.value;
        const end = cumulative / total;
        const a1 = start * Math.PI * 2 - Math.PI / 2;
        const a2 = end * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy + r * Math.sin(a2);
        const large = end - start > 0.5 ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        return <path key={d.type} d={path} fill={shades[i % shades.length]} opacity={0.9} stroke="#09090b" strokeWidth="1.5" />;
      })}
      <circle cx={cx} cy={cy} r={30} fill="#09090b" />
    </svg>
  );
}

// tiny line sparkline: just sums per month of creation (stand-in since no NAV history)
function GrowthLine({ investments }) {
  const now = new Date();
  const points = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const v = investments
      .filter((inv) => (inv.start_date || "").slice(0, 7) <= key)
      .reduce((s, inv) => s + (inv.current_value || inv.amount_invested || 0), 0);
    points.push({ k: key, v });
  }
  const max = Math.max(...points.map((p) => p.v), 1);
  const w = 600, h = 120, pad = 12;
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1 || 1);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
      <path d={d} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
      <path d={`${d} L ${x(points.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`} fill="rgba(255,255,255,0.05)" />
      {points.map((p, i) => (
        <g key={p.k}>
          <circle cx={x(i)} cy={y(p.v)} r="2.5" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}

export default function Investments() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState({
    type: "Equity", provider: "", amount_invested: "", start_date: "", maturity_date: "", current_value: "", notes: "",
  });

  const load = async () => {
    const [i, s] = await Promise.all([api.get("/investments"), api.get("/investments/summary")]);
    setItems(i.data);
    setSummary(s.data);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.provider.trim() || !Number(draft.amount_invested)) return;
    try {
      await api.post("/investments", {
        ...draft,
        amount_invested: Number(draft.amount_invested),
        current_value: draft.current_value ? Number(draft.current_value) : null,
      });
      setDraft({ type: "Equity", provider: "", amount_invested: "", start_date: "", maturity_date: "", current_value: "", notes: "" });
      await load();
      toast.success("Investment added");
    } catch { toast.error("Failed"); }
  };

  const patch = async (id, body) => { await api.patch(`/investments/${id}`, body); await load(); };
  const remove = async (id) => { await api.delete(`/investments/${id}`); await load(); };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="investments-page">
      <SectionTitle subtitle="Portfolio" title="Investments & Insurance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="inv-invested" label="Invested" value={fmtINR(summary?.total_invested ?? 0)} />
        <Stat testid="inv-value" label="Current value" value={fmtINR(summary?.total_value ?? 0)} />
        <Stat testid="inv-growth" label="Growth"
          value={summary?.growth_percent != null ? `${summary.growth_percent > 0 ? "+" : ""}${summary.growth_percent}%` : "—"}
          hint={`${summary?.count ?? 0} holdings`}
        />
        <Stat testid="inv-maturities" label="Upcoming maturities" value={summary?.upcoming_maturities?.length ?? 0} hint="Next 90 days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col items-center" data-testid="allocation-card">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60 mb-4 self-start">
            Allocation
          </div>
          {summary?.allocation?.length ? (
            <>
              <MonochromePie data={summary.allocation} />
              <ul className="w-full mt-4 space-y-1.5 text-xs">
                {summary.allocation.map((a, i) => {
                  const pct = summary.total_value
                    ? Math.round((a.value / summary.total_value) * 100)
                    : 0;
                  return (
                    <li key={a.type} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{
                          background: ["#ffffff", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b"][i % 5],
                        }}
                      />
                      <span className="flex-1">{a.type}</span>
                      <span className="text-white/60">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="text-sm text-white/40 py-12">Add investments to see allocation</div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2" data-testid="growth-card">
          <div className="mm-font-display uppercase tracking-[0.2em] text-xs text-white/60 mb-4">
            Growth (6 months)
          </div>
          {items.length ? <GrowthLine investments={items} /> : (
            <div className="text-sm text-white/40 py-12">No data yet</div>
          )}
          {summary?.upcoming_maturities?.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Upcoming maturities</div>
              {summary.upcoming_maturities.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div>{m.provider}</div>
                  <div className="text-white/60">{m.days} days ({m.maturity_date})</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4" data-testid="inv-add-row">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="mm-input text-sm">
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Provider" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} className="mm-input text-sm md:col-span-2" data-testid="new-inv-provider" />
          <input type="number" placeholder="Invested" value={draft.amount_invested} onChange={(e) => setDraft({ ...draft, amount_invested: e.target.value })} className="mm-input text-sm" data-testid="new-inv-amount" />
          <input type="number" placeholder="Current value" value={draft.current_value} onChange={(e) => setDraft({ ...draft, current_value: e.target.value })} className="mm-input text-sm" />
          <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className="mm-input text-sm" />
          <button onClick={add} disabled={!draft.provider.trim() || !Number(draft.amount_invested)} className="mm-btn-primary text-sm disabled:opacity-40 flex items-center justify-center gap-1.5" data-testid="new-inv-submit">
            <Plus size={14} /> Add
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No investments tracked" hint="Track insurance, MFs, equities, FDs — the dashboard aggregates automatically." />
      ) : (
        <Card className="p-0 overflow-hidden" data-testid="inv-table">
          <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_120px_40px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <div>Type</div><div>Provider</div><div>Invested</div><div>Current</div><div>Start</div><div>Maturity</div><div />
          </div>
          {items.map((i) => (
            <div key={i.id} className="grid grid-cols-2 md:grid-cols-[100px_1fr_120px_120px_120px_120px_40px] gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition items-center" data-testid="inv-row">
              <select value={i.type} onChange={(e) => patch(i.id, { type: e.target.value })} className="mm-input text-xs !py-1.5">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input defaultValue={i.provider} onBlur={(e) => patch(i.id, { provider: e.target.value })} className="mm-input text-sm !py-1.5" />
              <input type="number" defaultValue={i.amount_invested} onBlur={(e) => patch(i.id, { amount_invested: Number(e.target.value) })} className="mm-input text-sm !py-1.5" />
              <input type="number" defaultValue={i.current_value ?? ""} onBlur={(e) => patch(i.id, { current_value: e.target.value === "" ? null : Number(e.target.value) })} className="mm-input text-sm !py-1.5" />
              <input type="date" value={i.start_date || ""} onChange={(e) => patch(i.id, { start_date: e.target.value })} className="mm-input text-xs !py-1.5" />
              <input type="date" value={i.maturity_date || ""} onChange={(e) => patch(i.id, { maturity_date: e.target.value })} className="mm-input text-xs !py-1.5" />
              <button onClick={() => remove(i.id)} className="text-white/40 hover:text-white transition justify-self-end" data-testid="inv-delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
