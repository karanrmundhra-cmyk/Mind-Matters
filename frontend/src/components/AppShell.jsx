import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Repeat,
  Landmark,
  Wallet,
  TrendingUp,
  StickyNote,
  FileText,
  BellRing,
  Calendar as CalendarIcon,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { subscribeSync } from "@/lib/syncQueue";

function humanAgo(ts) {
  if (!ts) return "just now";
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
import Logo from "@/components/Logo";
import AiChat from "@/components/AiChat";
import QuickAdd from "@/components/QuickAdd";
import CommandPalette from "@/components/CommandPalette";
import FloatingDock from "@/components/FloatingDock";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, testid: "nav-tasks" },
  { to: "/routines", label: "Routines", icon: Repeat, testid: "nav-routines" },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet, testid: "nav-cashflow" },
  { to: "/notes", label: "Notes", icon: StickyNote, testid: "nav-notes" },
  { to: "/reminders", label: "Reminders", icon: BellRing, testid: "nav-reminders" },
  { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    localStorage.getItem("mm_sidebar_collapsed") === "1",
  );
  const [sync, setSync] = useState({ status: "green", pending: 0 });
  useEffect(() => subscribeSync(setSync), []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("mm_sidebar_collapsed", next ? "1" : "0");
  };

  const triggerSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }),
    );
  };

  const syncDotClass = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400 animate-pulse",
    red: "bg-red-400 animate-pulse",
  }[sync.status];

  return (
    <div className="min-h-screen w-full flex" data-testid="app-shell">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex shrink-0 flex-col h-screen sticky top-0 border-r border-[rgba(201,169,97,0.1)] py-6 transition-[width] duration-200 ${
          collapsed ? "w-16 px-2 items-center" : "w-60 px-5"
        }`}
        data-testid="sidebar"
        data-collapsed={collapsed ? "1" : "0"}
      >
        <div className={`flex items-center gap-3 mb-10 ${collapsed ? "justify-center" : ""}`}>
          <Logo size={collapsed ? 32 : 44} />
          {!collapsed && (
            <div>
              <div className="mm-font-serif text-lg leading-none mm-text-gold-bright">Mind Matters</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mt-1">
                Personal OS
              </div>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1 w-full">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center ${collapsed ? "justify-center" : "gap-3 px-3"} py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(201,169,97,0.12)] text-[#E4C98C] border border-[rgba(201,169,97,0.35)] shadow-[0_4px_16px_rgba(201,169,97,0.12)]"
                    : "text-[#B7A98A]/75 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.05)] border border-transparent"
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.5} />
              {!collapsed && <span className="mm-font-display">{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Action icons row (Quick Add · Search · AI · Sync) — replaces floating dock on desktop */}
        <div
          className={`mt-4 flex ${collapsed ? "flex-col items-center" : "flex-row justify-between"} gap-2 pt-3 border-t border-[rgba(201,169,97,0.12)]`}
          data-testid="sidebar-dock"
        >
          <button
            onClick={() => setQuickAddOpen(true)}
            title="Quick Add"
            data-testid="dock-quick-add"
            className="p-2 rounded-lg text-[#B7A98A]/65 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={triggerSearch}
            title="Search (⌘K)"
            data-testid="dock-search"
            className="p-2 rounded-lg text-[#B7A98A]/65 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition"
          >
            <Search size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            title="AI Assistant"
            data-testid="dock-ai"
            className="p-2 rounded-lg text-[#B7A98A]/65 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition"
          >
            <Sparkles size={16} strokeWidth={1.5} />
          </button>
          <button
            title={
              sync.status === "green"
                ? `Synced · ${humanAgo(sync.lastSyncAt)}`
                : sync.pending
                  ? `${sync.pending} change${sync.pending !== 1 ? "s" : ""} queued · last sync ${humanAgo(sync.lastSyncAt)}`
                  : `Reconnecting · last sync ${humanAgo(sync.lastSyncAt)}`
            }
            data-testid="dock-sync"
            data-sync-status={sync.status}
            className="p-2 rounded-lg text-[#B7A98A]/65 hover:bg-[rgba(201,169,97,0.06)] transition relative"
          >
            <span className={`block w-2.5 h-2.5 rounded-full ${syncDotClass}`} />
            {sync.pending > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 text-[9px] font-semibold rounded-full bg-[#C9A961] text-black flex items-center justify-center leading-none"
                data-testid="dock-sync-pending"
              >
                {sync.pending > 9 ? "9+" : sync.pending}
              </span>
            )}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="sidebar-collapse-toggle"
          className="mt-3 flex items-center justify-center w-full p-2 rounded-lg text-[#B7A98A]/55 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`mt-3 flex flex-col gap-3 pt-3 border-t border-[rgba(201,169,97,0.12)] ${collapsed ? "items-center" : ""}`}>
          {!collapsed && (
            <div className="text-xs">
              <div className="text-[#E4C98C]">{user?.first_name}</div>
              <div className="text-[#B7A98A]/55">{user?.email}</div>
            </div>
          )}
          <button
            data-testid="logout-btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className={`p-2 rounded-lg text-[#B7A98A]/55 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition ${collapsed ? "" : "self-end"}`}
            title="Sign out"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 relative min-w-0 pb-24 md:pb-10">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-6 md:py-10">
          <Outlet />
        </div>

        {/* Mobile-only floating dock (desktop dock lives inside the sidebar) */}
        <div className="md:hidden">
          <FloatingDock
            onQuickAdd={() => setQuickAddOpen(true)}
            onAi={() => setChatOpen((v) => !v)}
          />
        </div>

        <AiChat open={chatOpen} onClose={() => setChatOpen(false)} />
        <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
        <CommandPalette />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 mm-glass rounded-none border-t border-[rgba(201,169,97,0.18)] flex justify-around py-2 px-2 overflow-x-auto"
        data-testid="bottom-nav"
      >
        {NAV.slice(0, 6).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={`${n.testid}-mobile`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] ${
                isActive ? "mm-text-gold-bright" : "text-[#B7A98A]/60"
              }`
            }
          >
            <n.icon size={18} strokeWidth={1.5} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
