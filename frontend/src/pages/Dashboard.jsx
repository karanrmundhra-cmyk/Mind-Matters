import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjectReload } from "@/lib/projects";
import { Card } from "@/components/Primitives";
import {
  Wind, Plus, Trash2, CalendarClock, CheckSquare, Repeat, Wallet, StickyNote, BellRing, Banknote,
  BarChart3, Settings as SettingsIcon, Newspaper, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

function daysUntil(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return null;
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

const QUICK_NAV = [
  { to: "/tasks", label: "Tasks", icon: CheckSquare, testid: "quicknav-tasks" },
  { to: "/routines", label: "Routines", icon: Repeat, testid: "quicknav-routines" },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet, testid: "quicknav-cashflow" },
  { to: "/notes", label: "Notes", icon: StickyNote, testid: "quicknav-notes" },
  { to: "/reminders", label: "Reminders", icon: BellRing, testid: "quicknav-reminders" },
  { to: "/reports", label: "Reports", icon: BarChart3, testid: "quicknav-reports" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "quicknav-settings" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [weather, setWeather] = useState(null);
  const [quote, setQuote] = useState(null);
  const [affirmation, setAffirmation] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [draft, setDraft] = useState({ title: "", due_date: "" });
  const [loanSummary, setLoanSummary] = useState(null);
  const [news, setNews] = useState(null);
  const [newsCategory, setNewsCategory] = useState(
    localStorage.getItem("mm_news_category") || "all",
  );
  const [customRss, setCustomRss] = useState(
    localStorage.getItem("mm_news_custom_url") || "",
  );
  const [editingRss, setEditingRss] = useState(false);

  const load = async (signal) => {
    const newsUrl = customRss
      ? `/news?custom_url=${encodeURIComponent(customRss)}`
      : `/news?category=${encodeURIComponent(newsCategory)}`;
    const [w, q, a, d, ls, nw] = await Promise.all([
      api.get("/weather", { signal }),
      api.get("/quote/today", { signal }),
      api.get("/affirmations/today", { signal }),
      api.get("/deadlines", { signal }),
      api.get("/cashflow/loan-summary", { signal }).catch(() => ({ data: null })),
      api.get(newsUrl, { signal }).catch(() => ({ data: null })),
    ]);
    if (signal?.aborted) return;
    setWeather(w.data);
    setQuote(q.data);
    setAffirmation(a.data);
    setDeadlines(d.data || []);
    setLoanSummary(ls.data);
    setNews(nw.data);
  };
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => { /* aborted is fine */ });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsCategory, customRss]);
  useProjectReload(() => load());

  const savePersonalAffirmation = async (text) => {
    try {
      const { data } = await api.put("/affirmations/today", { personal_fixed: text });
      setAffirmation(data);
    } catch {
      toast.error("Could not save");
    }
  };

  const addDeadline = async () => {
    if (!draft.title.trim() || !draft.due_date) return;
    try {
      await api.post("/deadlines", draft);
      setDraft({ title: "", due_date: "" });
      await load();
      toast.success("Deadline added");
    } catch {
      toast.error("Failed");
    }
  };

  const removeDeadline = async (id) => {
    await api.delete(`/deadlines/${id}`);
    await load();
  };

  const patchDeadline = async (id, body) => {
    try {
      await api.patch(`/deadlines/${id}`, body);
      await load();
    } catch {
      toast.error("Could not save deadline");
    }
  };

  const deadlineToReminder = async (d) => {
    try {
      const base = new Date(d.due_date + "T09:00:00");
      await api.post("/reminders", {
        title: `Deadline: ${d.title}`,
        notes: d.notes || "",
        fire_at: base.toISOString(),
        recurrence: "none",
        source_page: "deadlines",
        source_context: { title: d.title, due_date: d.due_date, notes: d.notes || "" },
      });
      toast.success("Reminder created");
    } catch {
      toast.error("Reminder failed");
    }
  };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = now;
  const greetDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const greetTime = today.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const hour = today.getHours();
  const greet =
    hour < 5 ? "Hello" : hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6 sm:space-y-8 mm-fade-in" data-testid="dashboard-page">
      {/* Header greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-5">
        <div>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-[#B7A98A]/60" data-testid="dashboard-date-time">
            {greetDate} · {greetTime}
          </div>
          <h1 className="mm-font-display text-3xl sm:text-5xl lg:text-6xl text-white mt-2 font-light leading-tight">
            {greet},{" "}
            <span
              className="mm-font-serif italic"
              style={{
                background:
                  "linear-gradient(135deg, #F4E1A8 0%, #E4C98C 35%, #C9A961 70%, #A88945 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "0 0 28px rgba(228,201,140,0.18)",
              }}
              data-testid="dashboard-greet-name"
            >
              {user?.first_name || "Friend"}
            </span>
            .
          </h1>
          <div className="mm-wave-line mt-4" />
        </div>

        <Card className="px-5 py-3 sm:py-4 flex items-center gap-4 sm:min-w-[200px]">
          <Wind size={22} strokeWidth={1.3} className="mm-text-gold" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/65">
              Weather
            </div>
            <div className="mm-font-display text-xl mm-text-gold-bright">
              {weather?.temperature != null ? `${Math.round(weather.temperature)}°` : "—"}
            </div>
            <div className="text-xs text-[#B7A98A]/60">{weather?.label || "—"}</div>
          </div>
        </Card>
      </div>

      {/* Quick access icon row */}
      <div
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mm-focus-hide"
        data-testid="quick-nav-grid"
      >
        {QUICK_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border border-[rgba(201,169,97,0.2)] bg-[rgba(201,169,97,0.03)] hover:border-[#C9A961]/60 hover:bg-[rgba(201,169,97,0.08)] transition active:scale-95 min-h-[72px] sm:min-h-[88px]"
            data-testid={n.testid}
          >
            <n.icon
              size={22}
              strokeWidth={1.4}
              className="mm-text-gold-bright group-hover:scale-110 transition-transform"
            />
            <span className="text-[9px] sm:text-[11px] uppercase tracking-[0.18em] text-[#E4C98C]/85 text-center leading-tight">
              {n.label}
            </span>
          </NavLink>
        ))}
      </div>

      {/* Two affirmations: internet quote + user-fixed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 sm:p-6" data-testid="dashboard-quote-card">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 mb-3">
            Today's note from the world
          </div>
          {quote ? (
            <>
              <div className="mm-font-serif italic text-base sm:text-lg mm-text-gold-bright leading-snug">
                "{quote.text}"
              </div>
              {quote.author && (
                <div className="text-xs text-[#B7A98A]/55 mt-3">— {quote.author}</div>
              )}
            </>
          ) : (
            <div className="space-y-2" data-testid="quote-skeleton">
              <div className="h-3 rounded bg-[rgba(201,169,97,0.1)] animate-pulse w-5/6" />
              <div className="h-3 rounded bg-[rgba(201,169,97,0.08)] animate-pulse w-2/3" />
              <div className="h-2 rounded bg-[rgba(201,169,97,0.06)] animate-pulse w-1/3 mt-3" />
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6" data-testid="personal-affirmation-card">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 mb-3">
            Your personal affirmation
          </div>
          <textarea
            value={affirmation?.personal_fixed || ""}
            onChange={(e) => setAffirmation({ ...affirmation, personal_fixed: e.target.value })}
            onBlur={(e) => savePersonalAffirmation(e.target.value)}
            placeholder="I am the calm in my storm."
            rows={3}
            className="mm-input mm-font-serif italic text-base sm:text-lg resize-none"
            data-testid="personal-affirmation-input"
          />
          <div className="text-[10px] text-[#B7A98A]/45 mt-3 uppercase tracking-[0.25em]">
            Auto-saves
          </div>
        </Card>
      </div>

      {/* Loan summary widget — only renders when user has active loans */}
      {loanSummary && (loanSummary.active_loans > 0 || loanSummary.total_monthly_emi > 0) && (
        <NavLink
          to="/cash-flow"
          className="block"
          data-testid="loan-summary-card"
        >
          <Card className="p-5 sm:p-6 hover:border-[#C9A961]/45 transition group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-[rgba(201,169,97,0.25)] bg-[rgba(201,169,97,0.06)] flex items-center justify-center shrink-0">
                  <Banknote size={18} strokeWidth={1.4} className="mm-text-gold-bright" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65">
                    Loan summary
                  </div>
                  <div className="mm-font-display text-xl sm:text-2xl mm-text-gold-bright mt-1">
                    ₹
                    {(loanSummary.total_monthly_emi || 0).toLocaleString("en-IN")}
                    <span className="text-xs text-[#B7A98A]/55 ml-2 normal-case tracking-normal">
                      / month
                    </span>
                  </div>
                  <div className="text-xs text-[#B7A98A]/60 mt-1">
                    {loanSummary.active_loans} active loan
                    {loanSummary.active_loans !== 1 ? "s" : ""}
                    {loanSummary.next_repayment && (
                      <>
                        {" · next "}
                        <span className="mm-text-gold">
                          {loanSummary.next_repayment.vendor || "repayment"}
                        </span>{" "}
                        {loanSummary.next_repayment.days_until <= 0
                          ? "today"
                          : `in ${loanSummary.next_repayment.days_until} day${
                              loanSummary.next_repayment.days_until !== 1 ? "s" : ""
                            }`}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/45 group-hover:mm-text-gold transition">
                View →
              </span>
            </div>
          </Card>
        </NavLink>
      )}

      {/* News widget */}
      <Card className="p-5 sm:p-6 mm-focus-hide" data-testid="news-widget">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65">
            <Newspaper size={12} className="mm-text-gold" />
            Today's News
            {news?.source === "custom" && (
              <span
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[rgba(122,184,255,0.12)] text-[#7AB8FF] border border-[rgba(122,184,255,0.25)]"
                data-testid="news-source-chip"
              >
                Custom
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!customRss && (
              <select
                value={newsCategory}
                onChange={(e) => {
                  setNewsCategory(e.target.value);
                  localStorage.setItem("mm_news_category", e.target.value);
                }}
                className="mm-input-ghost text-[10px] !py-1 font-sans"
                data-testid="news-category"
              >
                <option value="all">All</option>
                <option value="business">Business</option>
                <option value="tech">Tech</option>
                <option value="india">India</option>
                <option value="world">World</option>
              </select>
            )}
            <button
              type="button"
              onClick={() => setEditingRss((v) => !v)}
              className="text-[10px] mm-text-gold/70 hover:mm-text-gold-bright transition uppercase tracking-wider font-sans"
              data-testid="news-rss-toggle"
              title="Set a custom RSS feed URL"
            >
              {customRss ? "Edit feed" : "Custom RSS"}
            </button>
          </div>
        </div>
        {editingRss && (
          <div className="mb-3 flex gap-2" data-testid="news-rss-editor">
            <input
              type="url"
              placeholder="https://example.com/feed.xml"
              value={customRss}
              onChange={(e) => setCustomRss(e.target.value)}
              className="mm-input text-xs flex-1"
              data-testid="news-rss-input"
            />
            <button
              onClick={() => {
                localStorage.setItem("mm_news_custom_url", customRss);
                setEditingRss(false);
                toast.success(customRss ? "Custom feed saved" : "Reverted to default feed");
              }}
              className="mm-btn-primary text-xs px-3"
              data-testid="news-rss-save"
            >
              Save
            </button>
            {customRss && (
              <button
                onClick={() => {
                  setCustomRss("");
                  localStorage.removeItem("mm_news_custom_url");
                  setEditingRss(false);
                  toast.success("Reset to default");
                }}
                className="text-xs text-[#B7A98A]/65 hover:text-[#E4C98C] transition px-2"
                data-testid="news-rss-reset"
              >
                Reset
              </button>
            )}
          </div>
        )}
        {!news ? (
          <div className="text-xs text-[#B7A98A]/50">Loading…</div>
        ) : news.items.length === 0 ? (
          <div className="text-xs text-[#B7A98A]/50">News unavailable</div>
        ) : (
          <div className="space-y-2">
            {news.items.map((item, i) => (
              <a
                key={i}
                href={item.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] hover:border-[#C9A961]/40 hover:bg-[rgba(201,169,97,0.04)] transition group"
                data-testid="news-item"
              >
                <ExternalLink size={11} className="mm-text-gold-bright shrink-0 mt-1" />
                <span className="text-xs sm:text-sm text-[#E4C98C]/85 group-hover:mm-text-gold-bright transition leading-snug">
                  {item.title}
                </span>
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* Deadlines countdown */}
      <Card className="p-5 sm:p-6" data-testid="deadlines-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65">
            <CalendarClock size={12} className="mm-text-gold" />
            Deadlines
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            placeholder="Deadline Title (e.g. Tax Filing)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mm-input text-sm"
            data-testid="deadline-title"
          />
          <input
            type="date"
            value={draft.due_date}
            onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
            className="mm-input text-sm"
            data-testid="deadline-date"
          />
          <button
            onClick={addDeadline}
            disabled={!draft.title.trim() || !draft.due_date}
            className="mm-btn-primary text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            data-testid="deadline-add"
          >
            <Plus size={14} /> Add Deadline
          </button>
        </div>

        {deadlines.length > 0 && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {deadlines.map((d) => {
              const days = daysUntil(d.due_date);
              const overdue = days !== null && days < 0;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-[rgba(201,169,97,0.2)] p-4 bg-[rgba(201,169,97,0.04)]"
                  data-testid="deadline-row"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <input
                        type="date"
                        value={d.due_date || ""}
                        onChange={(e) => patchDeadline(d.id, { due_date: e.target.value })}
                        className="mm-input text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/70 !py-1 !px-2 w-full max-w-[160px]"
                        data-testid="deadline-edit-date"
                      />
                      <input
                        defaultValue={d.title}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== d.title) patchDeadline(d.id, { title: v });
                        }}
                        className="mm-font-display text-base mm-text-gold-bright mt-2 bg-transparent outline-none w-full"
                        data-testid="deadline-edit-title"
                      />
                      <div
                        className={`text-xs mt-1 ${
                          overdue ? "text-red-300/80" : days <= 7 ? "mm-text-gold" : "text-[#B7A98A]/65"
                        }`}
                      >
                        {overdue
                          ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
                          : days === 0
                            ? "Today"
                            : `${days} day${days !== 1 ? "s" : ""} to go`}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={() => deadlineToReminder(d)}
                        className="text-[#B7A98A]/55 hover:text-[#E4C98C] transition p-1"
                        title="Create reminder"
                        data-testid="deadline-reminder"
                      >
                        <BellRing size={14} />
                      </button>
                      <button
                        onClick={() => removeDeadline(d.id)}
                        className="text-[#B7A98A]/50 hover:text-[#E4C98C] transition p-1"
                        data-testid="deadline-delete"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
