import React, { useEffect, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

/**
 * FloatingDock — bottom-right floating cluster, always visible.
 * Buttons: Quick Add (+) · Search (Cmd+K) · AI Sparkle · Sync status dot
 *
 * Sync dot:
 *   green  — last heartbeat succeeded < 60s ago
 *   yellow — last heartbeat 60s–5min ago OR navigator says offline but cache fresh
 *   red    — offline > 5min OR last heartbeat failed
 */
export default function FloatingDock({ onQuickAdd, onAi }) {
  const [sync, setSync] = useState({ status: "green", lastOk: Date.now() });

  // Heartbeat every 30s — pings /api/ to check connectivity.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        await api.get("/", { timeout: 5000 });
        if (!cancelled) setSync({ status: "green", lastOk: Date.now() });
      } catch {
        if (!cancelled) {
          setSync((prev) => {
            const ageSec = (Date.now() - prev.lastOk) / 1000;
            return {
              status: ageSec < 300 ? "yellow" : "red",
              lastOk: prev.lastOk,
            };
          });
        }
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    const onOnline = () => tick();
    const onOffline = () => setSync((p) => ({ ...p, status: "yellow" }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const dotColor = {
    green: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    yellow: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    red: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]",
  }[sync.status];

  const dotTitle = {
    green: "Synced · online",
    yellow: "Reconnecting…",
    red: "Offline · changes will sync later",
  }[sync.status];

  const triggerSearch = () => {
    // CommandPalette listens to Cmd/Ctrl+K globally — dispatch it.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }),
    );
  };

  const Btn = ({ onClick, title, testid, children }) => (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className="mm-glass mm-glass-hover w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{
        boxShadow:
          "0 6px 20px rgba(201,169,97,0.18), inset 0 1px 0 rgba(228,201,140,0.18)",
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed z-40 bottom-24 md:bottom-8 right-5 flex flex-col items-center gap-2.5"
      data-testid="floating-dock"
    >
      <Btn onClick={onQuickAdd} title="Quick add" testid="dock-quick-add">
        <Plus size={17} strokeWidth={1.6} className="mm-text-gold-bright" />
      </Btn>
      <Btn onClick={triggerSearch} title="Search (⌘K)" testid="dock-search">
        <Search size={16} strokeWidth={1.6} className="mm-text-gold-bright" />
      </Btn>
      <Btn onClick={onAi} title="Ask Mind Matters" testid="dock-ai">
        <Sparkles size={17} strokeWidth={1.6} className="mm-text-gold-bright" />
      </Btn>
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center mm-glass"
        title={dotTitle}
        data-testid="dock-sync"
        data-sync-status={sync.status}
        style={{
          boxShadow:
            "0 6px 20px rgba(201,169,97,0.12), inset 0 1px 0 rgba(228,201,140,0.12)",
        }}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      </div>
    </div>
  );
}
