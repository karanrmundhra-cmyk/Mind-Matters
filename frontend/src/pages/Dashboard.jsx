import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Stat } from "@/components/Primitives";
import {
  CheckSquare,
  Wallet,
  Landmark,
  Repeat,
  Plus,
  Wind,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import QuickAdd from "@/components/QuickAdd";
import { toast } from "sonner";

const fmtINR = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(n || 0);

export default function Dashboard() {
  const { user } = useAuth();
  const [snap, setSnap] = useState(null);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);
  const [affirmation, setAffirmation] = useState(null);
  const [quickKind, setQuickKind] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    const [s, w, n, a] = await Promise.all([
      api.get("/dashboard/snapshot"),
      api.get("/weather"),
      api.get("/news/headlines"),
      api.get("/affirmations/today"),
    ]);
    setSnap(s.data);
    setWeather(w.data);
    setNews(n.data.headlines || []);
    setAffirmation(a.data);
  };

  useEffect(() => {
    load();
  }, []);

  const saveAffirmation = async (text) => {
    try {
      const { data } = await api.put("/affirmations/today", { text });
      setAffirmation(data);
    } catch {
      toast.error("Could not save");
    }
  };

  const today = new Date();
  const greetDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hour = today.getHours();
  const greet =
    hour < 5 ? "Hello" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 mm-fade-in" data-testid="dashboard-page">
      {/* Header greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
            {greetDate}
          </div>
          <h1 className="mm-font-display text-4xl sm:text-5xl lg:text-6xl text-white mt-2 font-light">
            {greet},{" "}
            <span className="mm-font-serif italic text-white/90">
              {user?.first_name || "Friend"}
            </span>
            .
          </h1>
          <div className="mm-wave-line mt-4" />
        </div>

        <Card className="px-5 py-4 flex items-center gap-4 min-w-[220px]">
          <Wind size={22} strokeWidth={1.3} className="text-white/60" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Weather</div>
            <div className="mm-font-display text-xl">
              {weather?.temperature != null ? `${Math.round(weather.temperature)}°` : "—"}
            </div>
            <div className="text-xs text-white/50">{weather?.label || "—"}</div>
          </div>
        </Card>
      </div>

      {/* Quick add row */}
      <div className="flex flex-wrap gap-2">
        {[
          { kind: "task", label: "Task" },
          { kind: "expense", label: "Expense" },
          { kind: "note", label: "Note" },
        ].map((q) => (
          <button
            key={q.kind}
            onClick={() => setQuickKind(q.kind)}
            className="mm-btn-ghost text-sm flex items-center gap-2"
            data-testid={`quick-add-${q.kind}-btn`}
          >
            <Plus size={14} strokeWidth={1.5} /> {q.label}
          </button>
        ))}
        <button
          onClick={() => setQuickKind("task")}
          className="mm-btn-primary text-sm flex items-center gap-2 ml-auto"
          data-testid="quick-add-ai-btn"
        >
          <Sparkles size={14} /> Natural language add
        </button>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          testid="stat-pending-tasks"
          label="Pending tasks"
          value={snap?.pending_tasks_count ?? "—"}
          hint={
            snap?.pending_by_person?.length
              ? snap.pending_by_person
                  .slice(0, 3)
                  .map((p) => `${p.name} (${p.count})`)
                  .join(" · ")
              : "All clear"
          }
        />
        <Stat
          testid="stat-routine-today"
          label="Routines today"
          value={snap?.routine_percent_today != null ? `${snap.routine_percent_today}%` : "—"}
          hint="Completion for today"
        />
        <Stat
          testid="stat-cash-today"
          label="Net cash today"
          value={fmtINR(snap?.net_cash_today ?? 0)}
          hint={`Out ${fmtINR(snap?.cash_out_today ?? 0)}`}
        />
        <Stat
          testid="stat-loans-exposure"
          label="Loans — net exposure"
          value={fmtINR(snap?.loans_net_exposure ?? 0)}
          hint="Given minus taken"
        />
      </div>

      {/* Insights + Affirmation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2" data-testid="insights-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} strokeWidth={1.5} className="text-white/60" />
            <div className="mm-font-display text-sm uppercase tracking-[0.2em] text-white/60">
              Insights
            </div>
          </div>
          {snap?.insights?.length ? (
            <ul className="space-y-3">
              {snap.insights.map((ins, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-white/85"
                  data-testid="insight-row"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-white/45">
              No anomalies detected. You are in control.
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col" data-testid="affirmation-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="mm-font-display text-sm uppercase tracking-[0.2em] text-white/60">
              Today's affirmation
            </div>
          </div>
          <textarea
            value={affirmation?.text || ""}
            onChange={(e) => setAffirmation({ ...affirmation, text: e.target.value })}
            onBlur={(e) => saveAffirmation(e.target.value)}
            placeholder="I am the calm in my storm."
            rows={5}
            className="mm-input mm-font-serif italic text-lg flex-1 resize-none"
            data-testid="affirmation-input"
          />
          <div className="text-[10px] text-white/35 mt-3 uppercase tracking-[0.2em]">
            Auto-saves on blur
          </div>
        </Card>
      </div>

      {/* Quick links + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2" data-testid="module-shortcuts">
          <div className="mm-font-display text-sm uppercase tracking-[0.2em] text-white/60 mb-4">
            Jump in
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { to: "/tasks", icon: CheckSquare, label: "Tasks" },
              { to: "/routines", icon: Repeat, label: "Routines" },
              { to: "/loans", icon: Landmark, label: "Loans" },
              { to: "/cash-flow", icon: Wallet, label: "Cash Flow" },
            ].map((m) => (
              <button
                key={m.to}
                onClick={() => navigate(m.to)}
                className="mm-glass mm-glass-hover p-5 flex flex-col items-start gap-3"
                data-testid={`jump-${m.label.toLowerCase().replace(" ", "-")}`}
              >
                <m.icon size={18} strokeWidth={1.3} />
                <div className="mm-font-display text-sm">{m.label}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6" data-testid="news-card">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={14} strokeWidth={1.5} className="text-white/60" />
            <div className="mm-font-display text-sm uppercase tracking-[0.2em] text-white/60">
              Headlines
            </div>
          </div>
          <ul className="space-y-4">
            {news.map((h, i) => (
              <li key={i} className="text-sm">
                <div className="text-white/90 leading-snug">{h.title}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mt-1">
                  {h.source}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <QuickAdd
        open={!!quickKind}
        onClose={() => {
          setQuickKind(null);
          load();
        }}
        defaultKind={quickKind || "task"}
      />
    </div>
  );
}
