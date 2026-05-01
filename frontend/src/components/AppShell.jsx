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
  LogOut,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/Logo";
import AiChat from "@/components/AiChat";
import QuickAdd from "@/components/QuickAdd";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, testid: "nav-tasks" },
  { to: "/routines", label: "Routines", icon: Repeat, testid: "nav-routines" },
  { to: "/loans", label: "Loans", icon: Landmark, testid: "nav-loans" },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet, testid: "nav-cash-flow" },
  { to: "/investments", label: "Investments", icon: TrendingUp, testid: "nav-investments" },
  { to: "/notes", label: "Notes", icon: StickyNote, testid: "nav-notes" },
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
        className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 border-r border-white/5 px-5 py-6"
        data-testid="sidebar"
      >
        <div className="flex items-center gap-3 mb-10">
          <Logo size={30} />
          <div>
            <div className="mm-font-serif text-lg leading-none">Mind Matters</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mt-1">
              Personal OS
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-white/[0.06] text-white border border-white/10"
                    : "text-white/60 hover:text-white hover:bg-white/[0.03] border border-transparent"
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.5} />
              <span className="mm-font-display">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
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
              <div className="text-white/80">{user?.first_name}</div>
              <div className="text-white/40">{user?.email}</div>
            </div>
            <button
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition"
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
          title="Ask Mind Matters"
        >
          <Sparkles size={18} strokeWidth={1.5} />
        </button>

        <AiChat open={chatOpen} onClose={() => setChatOpen(false)} />
        <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 mm-glass rounded-none border-t border-white/10 flex justify-around py-2 px-2"
        data-testid="bottom-nav"
      >
        {NAV.slice(0, 5).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={`${n.testid}-mobile`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] ${
                isActive ? "text-white" : "text-white/50"
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
