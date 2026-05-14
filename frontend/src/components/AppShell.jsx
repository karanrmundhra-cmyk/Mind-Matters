import React, { useState } from "react";
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
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/Logo";
import AiChat from "@/components/AiChat";
import QuickAdd from "@/components/QuickAdd";
import CommandPalette from "@/components/CommandPalette";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, testid: "nav-tasks" },
  { to: "/routines", label: "Routines", icon: Repeat, testid: "nav-routines" },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet, testid: "nav-cashflow" },
  { to: "/notes", label: "Notes", icon: StickyNote, testid: "nav-notes" },
  { to: "/reminders", label: "Reminders", icon: BellRing, testid: "nav-reminders" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex" data-testid="app-shell">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 border-r border-[rgba(201,169,97,0.1)] px-5 py-6"
        data-testid="sidebar"
      >
        <div className="flex items-center gap-3 mb-10">
          <Logo size={44} />
          <div>
            <div className="mm-font-serif text-lg leading-none mm-text-gold-bright">Mind Matters</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/60 mt-1">
              Personal OS
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto pr-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(201,169,97,0.12)] text-[#E4C98C] border border-[rgba(201,169,97,0.35)] shadow-[0_4px_16px_rgba(201,169,97,0.12)]"
                    : "text-[#B7A98A]/75 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.05)] border border-transparent"
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.5} />
              <span className="mm-font-display">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <button
            data-testid="open-cmd-palette-sidebar"
            onClick={() => {
              // Dispatch keyboard event so CommandPalette toggles via its own listener
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="mm-btn-ghost text-sm flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} />
              Search
            </span>
            <span className="text-[10px] text-[#B7A98A]/40 tracking-widest">⌘K</span>
          </button>
          <button
            data-testid="open-quick-add-sidebar"
            onClick={() => setQuickAddOpen(true)}
            className="mm-btn-ghost text-sm flex items-center justify-center gap-2"
          >
            <Sparkles size={14} strokeWidth={1.5} />
            Quick add
          </button>
          <div className="mm-divider" />
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <div className="text-[#E4C98C]">{user?.first_name}</div>
              <div className="text-[#B7A98A]/55">{user?.email}</div>
            </div>
            <button
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="p-2 rounded-lg text-[#B7A98A]/55 hover:text-[#E4C98C] hover:bg-[rgba(201,169,97,0.06)] transition"
              title="Sign out"
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 relative min-w-0 pb-24 md:pb-10">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-6 md:py-10">
          <Outlet />
        </div>

        {/* Floating AI chat trigger */}
        <button
          data-testid="ai-chat-toggle"
          onClick={() => setChatOpen((v) => !v)}
          className="fixed z-40 bottom-24 md:bottom-8 right-6 mm-glass mm-glass-hover w-14 h-14 rounded-full flex items-center justify-center"
          style={{ boxShadow: "0 8px 32px rgba(201,169,97,0.25), inset 0 1px 0 rgba(228,201,140,0.25)" }}
          title="Ask Mind Matters"
        >
          <Sparkles size={18} strokeWidth={1.5} className="mm-text-gold-bright" />
        </button>

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
