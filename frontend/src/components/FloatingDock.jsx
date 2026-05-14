import React, { useEffect, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { subscribeSync, drainQueue } from "@/lib/syncQueue";

/**
 * FloatingDock — horizontal cluster pinned to the bottom-center, always visible.
 * Buttons: Quick Add (+) · Search (Cmd+K) · AI Sparkle · Sync status dot.
 *
 * The sync dot reflects the real IndexedDB write-queue state:
 *   green   — online, queue empty (everything synced)
 *   yellow  — online with pending writes (draining) OR offline with no queue yet
 *   red     — offline AND writes queued (will upload on reconnect)
 *
 * A small gold badge shows the pending-write count when > 0.
 */
export default function FloatingDock({ onQuickAdd, onAi }) {
  const [sync, setSync] = useState({ status: "green", pending: 0 });

  useEffect(() => subscribeSync(setSync), []);

  const dotColor = {
    green: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    yellow: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse",
    red: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)] animate-pulse",
  }[sync.status];

  const dotTitle = {
    green: "Synced · online",
    yellow:
      sync.pending > 0
        ? `Syncing ${sync.pending} change${sync.pending !== 1 ? "s" : ""}…`
        : "Reconnecting…",
    red: `Offline · ${sync.pending} change${sync.pending !== 1 ? "s" : ""} waiting`,
  }[sync.status];

  const triggerSearch = () => {
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
      className="fixed z-40 bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-row items-center gap-2.5 px-3 py-2 rounded-full mm-glass border border-[rgba(201,169,97,0.18)]"
      style={{
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(228,201,140,0.12)",
      }}
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
      <button
        onClick={() => drainQueue()}
        className="w-11 h-11 rounded-full flex items-center justify-center mm-glass relative transition-transform hover:scale-105 active:scale-95"
        title={dotTitle}
        data-testid="dock-sync"
        data-sync-status={sync.status}
        style={{
          boxShadow:
            "0 6px 20px rgba(201,169,97,0.12), inset 0 1px 0 rgba(228,201,140,0.12)",
        }}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        {sync.pending > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-[#C9A961] text-black flex items-center justify-center leading-none"
            data-testid="dock-sync-pending"
          >
            {sync.pending > 99 ? "99+" : sync.pending}
          </span>
        )}
      </button>
    </div>
  );
}
