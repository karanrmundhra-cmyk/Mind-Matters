import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import { ChevronLeft, ChevronRight, BellRing, CheckSquare, CalendarClock } from "lucide-react";

/**
 * Calendar — month-grid view with events drawn from tasks, reminders and
 * deadlines. A small "Reminders" tab embeds the same per-day breakdown
 * sorted as a chronological agenda.
 */
const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "agenda", label: "Agenda" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(year, month) {
  return new Date(year, month, 1);
}
function endOfMonth(year, month) {
  return new Date(year, month + 1, 0);
}
function toISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Calendar() {
  const today = new Date();
  const [tab, setTab] = useState("calendar");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  const load = async () => {
    const [t, r, d] = await Promise.all([
      api.get("/tasks"),
      api.get("/reminders"),
      api.get("/deadlines"),
    ]);
    setTasks(t.data || []);
    setReminders(r.data || []);
    setDeadlines(d.data || []);
  };
  useEffect(() => {
    load();
  }, []);

  // Build a date-keyed map of events for fast lookup
  const eventsByDate = useMemo(() => {
    const m = new Map();
    const push = (iso, ev) => {
      if (!iso) return;
      if (!m.has(iso)) m.set(iso, []);
      m.get(iso).push(ev);
    };
    tasks.forEach((t) => {
      if (t.date) {
        push(t.date, {
          kind: "task",
          title: t.task,
          subtitle: t.name || t.group,
          status: t.status,
        });
      }
    });
    reminders.forEach((r) => {
      if (r.fire_at) {
        push(r.fire_at.slice(0, 10), {
          kind: "reminder",
          title: r.title,
          subtitle: r.recurrence || "",
        });
      }
    });
    deadlines.forEach((d) => {
      if (d.due_date) {
        push(d.due_date, { kind: "deadline", title: d.title });
      }
    });
    return m;
  }, [tasks, reminders, deadlines]);

  // Build the 6-row grid of dates (including leading/trailing days from siblings)
  const days = useMemo(() => {
    const first = startOfMonth(year, month);
    const last = endOfMonth(year, month);
    const grid = [];
    const startWeekday = first.getDay();
    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      grid.push({ d, outOfMonth: true });
    }
    for (let i = 1; i <= last.getDate(); i++) {
      grid.push({ d: new Date(year, month, i), outOfMonth: false });
    }
    while (grid.length % 7 !== 0 || grid.length < 42) {
      const lastDay = grid[grid.length - 1].d;
      const next = new Date(lastDay);
      next.setDate(lastDay.getDate() + 1);
      grid.push({ d: next, outOfMonth: next.getMonth() !== month });
      if (grid.length >= 42) break;
    }
    return grid;
  }, [year, month]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayISO = toISO(today);

  const shift = (n) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  // Agenda: flat list of all events in this month, sorted by date
  const agenda = useMemo(() => {
    const start = toISO(startOfMonth(year, month));
    const end = toISO(endOfMonth(year, month));
    const out = [];
    eventsByDate.forEach((list, iso) => {
      if (iso < start || iso > end) return;
      list.forEach((ev) => out.push({ ...ev, date: iso }));
    });
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [eventsByDate, year, month]);

  return (
    <div className="space-y-5 mm-fade-in" data-testid="calendar-page">
      <SectionTitle
        subtitle="Time"
        title="Calendar"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => shift(-1)}
              className="mm-btn-ghost text-xs flex items-center gap-1"
              data-testid="cal-prev"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="mm-chip mm-chip-gold" data-testid="cal-month">
              {monthLabel}
            </span>
            <button
              onClick={() => shift(1)}
              className="mm-btn-ghost text-xs flex items-center gap-1"
              data-testid="cal-next"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setYear(d.getFullYear());
                setMonth(d.getMonth());
              }}
              className="mm-btn-ghost text-xs"
              data-testid="cal-today"
            >
              Today
            </button>
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl">
        All your tasks, reminders and deadlines in one view.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[rgba(201,169,97,0.12)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-[0.2em] transition border-b-2 -mb-px ${
              tab === t.id
                ? "mm-text-gold-bright border-[#C9A961]"
                : "text-[#B7A98A]/55 border-transparent hover:text-[#E4C98C]"
            }`}
            data-testid={`cal-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <Card className="p-0 overflow-hidden" data-testid="cal-grid">
          <div className="grid grid-cols-7 border-b border-[rgba(201,169,97,0.18)]">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 text-center"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(({ d, outOfMonth }, idx) => {
              const iso = toISO(d);
              const events = eventsByDate.get(iso) || [];
              const isToday = iso === todayISO;
              return (
                <div
                  key={idx}
                  className={`min-h-[88px] sm:min-h-[110px] p-2 border-b border-r border-[rgba(201,169,97,0.08)] ${
                    outOfMonth ? "opacity-30" : ""
                  } ${isToday ? "bg-[rgba(201,169,97,0.06)]" : ""}`}
                  data-testid={`cal-cell-${iso}`}
                >
                  <div
                    className={`text-xs mb-1 ${
                      isToday
                        ? "mm-text-gold-bright font-semibold"
                        : "text-[#B7A98A]/65"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {events.slice(0, 3).map((ev, i) => (
                      <div
                        key={i}
                        className={`text-[10px] truncate rounded px-1.5 py-0.5 border ${
                          ev.kind === "task"
                            ? "border-[#C9A961]/30 bg-[rgba(201,169,97,0.06)] mm-text-gold-bright"
                            : ev.kind === "reminder"
                              ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200/85"
                              : "border-red-400/30 bg-red-400/5 text-red-200/85"
                        }`}
                        title={`${ev.kind}: ${ev.title}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {events.length > 3 && (
                      <div className="text-[9px] text-[#B7A98A]/45">
                        +{events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "agenda" && (
        <Card className="p-0 overflow-hidden" data-testid="cal-agenda">
          {agenda.length === 0 ? (
            <EmptyState
              title={`No events in ${monthLabel}`}
              hint="Add tasks with a date, reminders, or deadlines and they'll show up here."
            />
          ) : (
            agenda.map((ev, i) => (
              <div
                key={i}
                className="grid grid-cols-[120px_auto_1fr] gap-3 px-5 py-3 border-b border-[rgba(201,169,97,0.08)] items-center"
                data-testid="cal-agenda-row"
              >
                <div className="text-xs text-[#B7A98A]/65">
                  {new Date(ev.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <span
                  className={`mm-chip ${
                    ev.kind === "task"
                      ? "mm-chip-gold"
                      : ev.kind === "reminder"
                        ? "border-emerald-400/40 text-emerald-200/85"
                        : "border-red-400/40 text-red-200/85"
                  } text-[10px] flex items-center gap-1`}
                >
                  {ev.kind === "task" ? (
                    <CheckSquare size={10} />
                  ) : ev.kind === "reminder" ? (
                    <BellRing size={10} />
                  ) : (
                    <CalendarClock size={10} />
                  )}
                  {ev.kind}
                </span>
                <div className="text-sm">
                  <div className="mm-text-gold-bright truncate">{ev.title}</div>
                  {ev.subtitle && (
                    <div className="text-[11px] text-[#B7A98A]/55 truncate">
                      {ev.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
