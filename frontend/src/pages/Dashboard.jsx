import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/Primitives";
import { Wind, Plus, Newspaper, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const fmtINR = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(n || 0);

function daysUntil(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return null;
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [snap, setSnap] = useState(null);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);
  const [affirmation, setAffirmation] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [draft, setDraft] = useState({ title: "", due_date: "" });

  const load = async () => {
    const [s, w, n, a, d] = await Promise.all([
      api.get("/dashboard/snapshot"),
      api.get("/weather"),
      api.get("/news/headlines"),
      api.get("/affirmations/today"),
      api.get("/deadlines"),
    ]);
    setSnap(s.data);
    setWeather(w.data);
    setNews(n.data.headlines || []);
    setAffirmation(a.data);
    setDeadlines(d.data || []);
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

  const today = new Date();
  const greetDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hour = today.getHours();
  const greet =
    hour < 5
      ? "Hello"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";

  return (
    <div className="space-y-8 mm-fade-in" data-testid="dashboard-page">
      {/* Header greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#B7A98A]/60">
            {greetDate}
          </div>
          <h1 className="mm-font-display text-4xl sm:text-5xl lg:text-6xl text-white mt-2 font-light">
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

        <Card className="px-5 py-4 flex items-center gap-4 min-w-[220px]">
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

      {/* Routine completion + Today affirmation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6" data-testid="stat-routine-today">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60">
            Routines today
          </div>
          <div className="mm-font-display text-5xl mm-text-gold-bright mt-3">
            {snap?.routine_percent_today != null ? `${snap.routine_percent_today}%` : "—"}
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-[rgba(201,169,97,0.12)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#E4C98C] to-[#C9A961]"
              style={{
                width: `${snap?.routine_percent_today ?? 0}%`,
                transition: "width 600ms ease",
              }}
            />
          </div>
          <div className="text-xs text-[#B7A98A]/60 mt-3">
            Tick your routines on the Routines page to keep the streak alive.
          </div>
        </Card>

        <Card className="p-6 md:col-span-2" data-testid="affirmation-card">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60 mb-3">
            Today's affirmation
          </div>
          <textarea
            value={affirmation?.text || ""}
            onChange={(e) => setAffirmation({ ...affirmation, text: e.target.value })}
            onBlur={(e) => saveAffirmation(e.target.value)}
            placeholder="I am the calm in my storm."
            rows={3}
            className="mm-input mm-font-serif italic text-lg resize-none"
            data-testid="affirmation-input"
          />
          <div className="text-[10px] text-[#B7A98A]/45 mt-3 uppercase tracking-[0.25em]">
            Auto-saves on blur
          </div>
        </Card>
      </div>

      {/* Deadlines countdown */}
      <Card className="p-6" data-testid="deadlines-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65">
            <CalendarClock size={12} className="mm-text-gold" />
            Deadlines
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Deadline title (e.g. Tax filing)"
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
            <Plus size={14} /> Add deadline
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
                  className="rounded-xl border border-[rgba(201,169,97,0.2)] p-4 flex items-center justify-between bg-[rgba(201,169,97,0.04)]"
                  data-testid="deadline-row"
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60">
                      {new Date(d.due_date).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="mm-font-display text-base mm-text-gold-bright mt-1">
                      {d.title}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        overdue
                          ? "text-red-300/80"
                          : days <= 7
                            ? "mm-text-gold"
                            : "text-[#B7A98A]/65"
                      }`}
                    >
                      {overdue
                        ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
                        : days === 0
                          ? "Today"
                          : `${days} day${days !== 1 ? "s" : ""} to go`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeDeadline(d.id)}
                    className="text-[#B7A98A]/50 hover:text-[#E4C98C]"
                    data-testid="deadline-delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* News */}
      <Card className="p-6" data-testid="news-card">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={14} strokeWidth={1.5} className="mm-text-gold" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/65">
            Headlines
          </div>
        </div>
        <ul className="space-y-4">
          {news.map((h, i) => (
            <li key={i} className="text-sm">
              {h.url ? (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mm-text-gold-bright hover:underline leading-snug"
                >
                  {h.title}
                </a>
              ) : (
                <div className="mm-text-gold-bright leading-snug">{h.title}</div>
              )}
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/40 mt-1">
                {h.source}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
