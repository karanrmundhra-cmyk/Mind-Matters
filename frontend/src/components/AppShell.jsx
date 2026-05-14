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
  Calendar as CalendarIcon,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
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
  { to: "/calendar", label: "Calendar", icon: CalendarIcon, testid: "nav-calendar" },
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

        {/* Floating bottom-right dock — Quick Add · Search · AI · Sync */}
        <FloatingDock
          onQuickAdd={() => setQuickAddOpen(true)}
          onAi={() => setChatOpen((v) => !v)}
        />

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
