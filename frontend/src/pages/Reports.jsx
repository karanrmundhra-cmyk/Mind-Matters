import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import {
  TrendingUp,
  Clock,
  Sparkles,
  Radar,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "inbox", label: "Inbox", icon: Clock },
  { id: "brief", label: "Daily Brief", icon: Sparkles },
  { id: "synopsis", label: "Synopsis", icon: TrendingUp },
  { id: "briefing", label: "AI Briefing", icon: Sparkles },
  { id: "patterns", label: "Pattern Radar", icon: Radar },
];

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function Reports() {
  const [tab, setTab] = useState("synopsis");
  const [monthly, setMonthly] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [aiPatterns, setAiPatterns] = useState([]);
  const [aiPatternsBusy, setAiPatternsBusy] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [briefingBusy, setBriefingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, t, p] = await Promise.all([
        api.get("/reports/cashflow-monthly?months=6"),
        api.get("/reports/timeline?days=30"),
        api.get("/reports/patterns"),
      ]);
      setMonthly(m.data || []);
      setTimeline(t.data || []);
      setPatterns(p.data || []);
    })();
  }, []);

  const generateBriefing = async () => {
    setBriefingBusy(true);
    try {
      const { data } = await api.post("/reports/briefing", {});
      setBriefing(data);
    } catch {
      toast.error("Could not generate briefing");
    } finally {
      setBriefingBusy(false);
    }
  };

  const generateAiPatterns = async () => {
    setAiPatternsBusy(true);
    try {
      const { data } = await api.get("/reports/ai-patterns");
      setAiPatterns(data || []);
      if (!data || data.length === 0) {
        toast("No additional AI patterns surfaced yet");
      }
    } catch {
      toast.error("Could not scan for AI patterns");
    } finally {
      setAiPatternsBusy(false);
    }
  };

  return (
    <div className="space-y-5 mm-fade-in" data-testid="reports-page">
      <SectionTitle
        subtitle="Insight"
        title="Reports"
        right={
          <button
            onClick={async () => {
              const [m, t, p] = await Promise.all([
                api.get("/reports/cashflow-monthly?months=6"),
                api.get("/reports/timeline?days=30"),
                api.get("/reports/patterns"),
              ]);
              setMonthly(m.data || []);
              setTimeline(t.data || []);
              setPatterns(p.data || []);
              toast.success("Refreshed");
            }}
            className="mm-btn-ghost text-xs flex items-center gap-1.5"
            data-testid="reports-refresh"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        Patterns, charts and AI briefings drawn from your tasks, cash flow and
        routines.
      </p>

      <div className="flex items-center gap-1 border-b border-[rgba(201,169,97,0.12)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-[0.2em] transition border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
              tab === t.id
                ? "mm-text-gold-bright border-[#C9A961]"
                : "text-[#B7A98A]/55 border-transparent hover:text-[#E4C98C]"
            }`}
            data-testid={`reports-tab-${t.id}`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <Card className="p-0 overflow-hidden" data-testid="reports-inbox">
          {patterns.length === 0 && timeline.length === 0 ? (
            <EmptyState title="All clear. You're on top of things." hint="Items needing your attention will surface here." />
          ) : (
            <>
              {patterns.filter((p) => p.severity !== "info").map((p, i) => (
                <div
                  key={`p-${i}`}
                  className="px-5 py-4 border-b border-[rgba(201,169,97,0.08)] flex items-start gap-3"
                  data-testid="inbox-item"
                >
                  <AlertTriangle size={14} className="mm-text-gold-bright shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm mm-text-gold-bright">{p.title}</div>
                    {p.detail && (
                      <div className="text-[11px] text-[#B7A98A]/65 mt-1">{p.detail}</div>
                    )}
                  </div>
                </div>
              ))}
              {timeline.slice(0, 8).map((ev, i) => (
                <div
                  key={`t-${i}`}
                  className="px-5 py-3 border-b border-[rgba(201,169,97,0.08)] flex items-start gap-3"
                  data-testid="inbox-item"
                >
                  <Clock size={14} className="text-[#B7A98A]/65 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm mm-text-gold-bright truncate">{ev.title}</div>
                    {ev.subtitle && (
                      <div className="text-[11px] text-[#B7A98A]/55 truncate">{ev.subtitle}</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      )}

      {tab === "brief" && (
        <Card className="p-6" data-testid="reports-daily-brief">
          <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold mb-4">
            Today at a glance
          </div>
          <div className="mm-font-serif text-base mm-text-gold-bright leading-relaxed">
            {briefing?.summary ||
              "Tap 'AI Briefing' for a Gemini-written briefing — or use this view as a quick today snapshot powered by Pattern Radar and Timeline."}
          </div>
          {patterns.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60">
                What needs attention
              </div>
              {patterns.slice(0, 4).map((p, i) => (
                <div
                  key={i}
                  className="text-sm text-[#B7A98A]/85 flex items-start gap-2"
                >
                  <span className="mm-text-gold">•</span>
                  <span>{p.title}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "synopsis" && (
        <Card className="p-4 sm:p-6" data-testid="reports-synopsis">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 mb-4">
            Monthly cash flow (last 6 months)
          </div>
          {monthly.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              hint="Add entries on the Cash Flow page and they'll roll up here."
            />
          ) : (
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,169,97,0.1)" />
                  <XAxis
                    dataKey="month"
                    stroke="#B7A98A"
                    style={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#B7A98A"
                    style={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(14,13,10,0.95)",
                      border: "1px solid rgba(201,169,97,0.35)",
                      borderRadius: 8,
                      color: "#E4C98C",
                    }}
                    formatter={(v) => fmtINR(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#B7A98A" }} />
                  <Bar dataKey="income" fill="#34D399" />
                  <Bar dataKey="expense" fill="#C9A961" />
                  <Bar dataKey="asset" fill="#60A5FA" />
                  <Bar dataKey="liability" fill="#F87171" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {tab === "briefing" && (
        <Card className="p-6" data-testid="reports-briefing">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                Weekly briefing
              </div>
              <div className="mm-font-display text-base mt-1 text-[#B7A98A]/75">
                AI-summarised view of your last 7 days.
              </div>
            </div>
            <button
              onClick={generateBriefing}
              disabled={briefingBusy}
              className="mm-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
              data-testid="reports-briefing-generate"
            >
              <Sparkles size={12} />
              {briefingBusy ? "Generating…" : briefing ? "Regenerate" : "Generate briefing"}
            </button>
          </div>
          {briefing ? (
            <>
              <div className="mm-font-serif italic text-base sm:text-lg mm-text-gold-bright leading-relaxed">
                "{briefing.summary}"
              </div>
              {briefing.snapshot && (
                <div className="grid grid-cols-3 gap-3 mt-5">
                  <Stat
                    label="Tasks done"
                    value={briefing.snapshot.tasks_completed_this_week}
                    testid="briefing-stat-tasks-done"
                  />
                  <Stat
                    label="Open tasks"
                    value={briefing.snapshot.tasks_open}
                    testid="briefing-stat-tasks-open"
                  />
                  <Stat
                    label="Spent"
                    value={fmtINR(briefing.snapshot.expense_this_week)}
                    testid="briefing-stat-expense"
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No briefing yet"
              hint="Tap 'Generate briefing' to get a short, AI-written summary of your week."
            />
          )}
        </Card>
      )}

      {tab === "patterns" && (
        <div className="space-y-4">
          <Card className="p-4 sm:p-6" data-testid="reports-ai-patterns-card">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                  AI Pattern Detector
                </div>
                <div className="text-xs text-[#B7A98A]/65 mt-1">
                  Non-obvious patterns from your last 60 days, scanned by Gemini.
                </div>
              </div>
              <button
                onClick={generateAiPatterns}
                disabled={aiPatternsBusy}
                className="mm-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
                data-testid="reports-ai-patterns-scan"
              >
                <Sparkles size={12} />
                {aiPatternsBusy ? "Scanning…" : aiPatterns.length ? "Re-scan" : "Scan with AI"}
              </button>
            </div>
            {aiPatterns.length === 0 ? (
              <div className="text-[11px] text-[#B7A98A]/45 py-2">
                Tap "Scan with AI" — the model looks across vendors, weekdays, categories
                and routine cadence to call out anything a rule-checker would miss.
              </div>
            ) : (
              <div className="space-y-2">
                {aiPatterns.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#C9A961]/30 bg-[rgba(201,169,97,0.04)] p-3"
                    data-testid="reports-ai-pattern-row"
                  >
                    <div className="text-sm mm-text-gold-bright">{p.title}</div>
                    {p.detail && (
                      <div className="text-[11px] text-[#B7A98A]/70 mt-1">{p.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-0 overflow-hidden" data-testid="reports-patterns">
          {patterns.length === 0 ? (
            <EmptyState
              title="No patterns detected"
              hint="As you add more data, anomalies, spikes and streaks will surface here."
            />
          ) : (
            patterns.map((p, i) => {
              const Icon =
                p.severity === "alert"
                  ? AlertTriangle
                  : p.severity === "warn"
                    ? AlertTriangle
                    : p.severity === "info"
                      ? Info
                      : CheckCircle2;
              const colour =
                p.severity === "alert"
                  ? "text-red-300 border-red-400/40"
                  : p.severity === "warn"
                    ? "mm-text-gold border-[#C9A961]/45"
                    : "text-emerald-200/85 border-emerald-400/35";
              return (
                <div
                  key={i}
                  className="px-5 py-4 border-b border-[rgba(201,169,97,0.08)] flex items-start gap-3"
                  data-testid="reports-pattern-row"
                >
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colour}`}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm mm-text-gold-bright">{p.title}</div>
                    {p.detail && (
                      <div className="text-[11px] text-[#B7A98A]/65 mt-1">
                        {p.detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, testid }) {
  return (
    <div
      className="rounded-lg border border-[rgba(201,169,97,0.18)] bg-[rgba(201,169,97,0.04)] p-3"
      data-testid={testid}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60">
        {label}
      </div>
      <div className="mm-font-display text-lg mm-text-gold-bright mt-1">
        {value}
      </div>
    </div>
  );
}
