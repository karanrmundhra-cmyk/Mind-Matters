import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Cmd+K universal search palette. Searches Tasks / Notes / Cash Flow /
 * Reminders. Debounced by 200ms. Keyboard: ↑ ↓ Enter Esc.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K to toggle.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQ("");
      setGroups([]);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setGroups([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setGroups(data.groups || []);
        setActive(0);
      } catch { /* */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  // Flatten for keyboard nav.
  const flat = groups.flatMap((g) =>
    g.items.map((it) => ({ ...it, _route: g.route, _module: g.module })),
  );

  const choose = (idx) => {
    const item = flat[idx];
    if (!item) return;
    setOpen(false);
    navigate(item._route);
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={() => setOpen(false)}
      data-testid="cmd-palette-backdrop"
    >
      <div
        className="mm-glass w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="cmd-palette"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(201,169,97,0.18)]">
          <Search size={16} className="text-[#B7A98A]/60" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, flat.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(active);
              }
            }}
            placeholder="Search anything across Mind Matters…"
            className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30"
            data-testid="cmd-palette-input"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white/80"
            data-testid="cmd-palette-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!q.trim() && (
            <div className="px-5 py-8 text-center text-xs text-[#B7A98A]/55">
              Type to search · Press <span className="mm-text-gold">⌘ K</span> to open from anywhere
            </div>
          )}
          {q.trim() && groups.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-[#B7A98A]/55" data-testid="cmd-palette-empty">
              No results found — try different keywords.
            </div>
          )}
          {(() => {
            let cursor = -1;
            return groups.map((g) => (
              <div key={g.module}>
                <div className="px-5 py-2 bg-[rgba(201,169,97,0.06)] text-[10px] uppercase tracking-[0.3em] mm-text-gold">
                  {g.label} · {g.items.length}
                </div>
                {g.items.map((it) => {
                  cursor += 1;
                  const isActive = cursor === active;
                  return (
                    <button
                      key={`${g.module}-${it.id}`}
                      onClick={() => choose(cursor)}
                      className={`w-full text-left px-5 py-3 border-b border-[rgba(201,169,97,0.06)] transition ${
                        isActive ? "bg-[rgba(201,169,97,0.08)]" : "hover:bg-white/[0.03]"
                      }`}
                      data-testid={`cmd-result-${g.module}`}
                    >
                      <div className="text-sm text-white">{it.title}</div>
                      {it.snippet && (
                        <div className="text-[11px] text-[#B7A98A]/60 mt-0.5 line-clamp-1">{it.snippet}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
        <div className="px-5 py-2 text-[10px] text-[#B7A98A]/45 uppercase tracking-[0.25em] border-t border-[rgba(201,169,97,0.1)] flex justify-between">
          <span>↑ ↓ navigate · ⏎ open · esc close</span>
          <span>{flat.length} results</span>
        </div>
      </div>
    </div>
  );
}
