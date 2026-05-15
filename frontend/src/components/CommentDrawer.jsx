import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, MessageSquare, Send, Trash2, AtSign } from "lucide-react";

/** Highlight @handles in a comment body. Returns an array of strings + spans. */
function renderBodyWithMentions(text) {
  if (!text) return null;
  const parts = [];
  const re = /(^|\s)(@[\w][\w.\-]{0,40})/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const lead = m[1];
    const handle = m[2];
    const idx = m.index + lead.length;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <span
        key={`m-${i++}`}
        className="mm-text-gold-bright font-medium bg-[rgba(201,169,97,0.12)] rounded px-0.5"
      >
        {handle}
      </span>,
    );
    last = idx + handle.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * CommentDrawer — right-side slide-in thread for a single row.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   projectId: string  — project the row belongs to
 *   resourceType: "task" | "routine" | "transaction" | "note"
 *   resourceId: string
 *   resourceLabel?: string  — small display title (e.g. task name)
 *   onCountChange?: (n) => void  — fired after fetch + after add/remove
 */
export default function CommentDrawer({
  open,
  onClose,
  projectId,
  resourceType,
  resourceId,
  resourceLabel,
  onCountChange,
}) {
  const [items, setItems] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mentionables, setMentionables] = useState([]);
  const [mention, setMention] = useState(null); // {start, query} or null
  const taRef = useRef(null);

  const load = useCallback(async () => {
    if (!projectId || !resourceId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/projects/${projectId}/comments?resource_type=${resourceType}&resource_id=${resourceId}`,
      );
      setItems(data || []);
      onCountChange?.(data?.length || 0);
    } catch (e) {
      if (e?.response?.status !== 403) {
        toast.error("Could not load comments");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, resourceType, resourceId, onCountChange]);

  useEffect(() => {
    if (open) {
      setBody("");
      setMention(null);
      load();
      setTimeout(() => taRef.current?.focus(), 80);
      if (projectId) {
        api.get(`/projects/${projectId}/mentionable`)
          .then(({ data }) => setMentionables(data || []))
          .catch(() => setMentionables([]));
      }
    }
  }, [open, load, projectId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const add = async () => {
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/comments`, {
        resource_type: resourceType,
        resource_id: resourceId,
        body: t,
      });
      const next = [...items, data];
      setItems(next);
      onCountChange?.(next.length);
      setBody("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not post comment");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api.delete(`/comments/${id}`);
      const next = items.filter((c) => c.id !== id);
      setItems(next);
      onCountChange?.(next.length);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete");
    }
  };

  const insertMention = (name) => {
    if (!mention) return;
    const before = body.slice(0, mention.start);
    const after = body.slice(mention.start + mention.query.length);
    const next = `${before}${name} ${after}`;
    setBody(next);
    setMention(null);
    setTimeout(() => {
      taRef.current?.focus();
      const pos = before.length + name.length + 1;
      taRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " · " +
          d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      onClick={onClose}
      data-testid="comment-drawer"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full bg-[#0a0805] border-l border-[rgba(201,169,97,0.25)] flex flex-col shadow-2xl"
      >
        <header className="px-5 py-4 border-b border-[rgba(201,169,97,0.15)] flex items-center gap-3">
          <MessageSquare size={14} className="mm-text-gold-bright" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] mm-text-gold">
              Thread
            </div>
            {resourceLabel && (
              <div className="text-xs mm-text-gold-bright truncate mt-0.5">
                {resourceLabel}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
            data-testid="comment-drawer-close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-xs text-[#B7A98A]/50 text-center py-6">Loading…</div>
          ) : items.length === 0 ? (
            <div
              className="text-xs text-[#B7A98A]/55 text-center py-10 border border-dashed border-[rgba(201,169,97,0.18)] rounded-lg"
              data-testid="comments-empty"
            >
              No comments yet. Start the conversation.
            </div>
          ) : (
            items.map((c) => (
              <div
                key={c.id}
                className="group rounded-lg border border-[rgba(201,169,97,0.15)] bg-[rgba(201,169,97,0.04)] px-3 py-2.5 hover:border-[rgba(201,169,97,0.3)] transition"
                data-testid={`comment-${c.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] mm-text-gold-bright font-medium">
                    {c.user_name || "Someone"}
                  </span>
                  <span className="text-[10px] text-[#B7A98A]/50 ml-auto">
                    {formatTime(c.created_at)}
                  </span>
                  <button
                    onClick={() => remove(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#B7A98A]/55 hover:text-red-300 transition p-0.5"
                    title="Delete comment"
                    data-testid={`comment-delete-${c.id}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="text-[12.5px] mm-text-gold/95 whitespace-pre-wrap mt-1 leading-relaxed">
                  {renderBodyWithMentions(c.body)}
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="px-5 py-3 border-t border-[rgba(201,169,97,0.15)] bg-[rgba(0,0,0,0.4)] relative">
          {mention && (
            (() => {
              const q = mention.query.toLowerCase();
              const matches = mentionables.filter(
                (m) =>
                  m.name.toLowerCase().includes(q) ||
                  m.email.toLowerCase().startsWith(q),
              ).slice(0, 6);
              if (matches.length === 0) return null;
              return (
                <div
                  className="absolute bottom-full left-5 right-5 mb-1 mm-glass border border-[rgba(201,169,97,0.3)] rounded-lg shadow-xl overflow-hidden"
                  data-testid="mention-popover"
                >
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] mm-text-gold/70 flex items-center gap-1.5 border-b border-[rgba(201,169,97,0.15)]">
                    <AtSign size={10} /> Mention member
                  </div>
                  {matches.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => insertMention(m.name)}
                      className="w-full text-left px-3 py-2 hover:bg-[rgba(201,169,97,0.1)] transition flex items-center gap-2"
                      data-testid={`mention-option-${m.user_id}`}
                    >
                      <span className="text-xs mm-text-gold-bright flex-1 truncate">
                        @{m.name}
                      </span>
                      <span className="text-[10px] text-[#B7A98A]/55 truncate max-w-[140px]">
                        {m.email}
                      </span>
                      {m.telegram_linked && (
                        <span
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[rgba(122,184,255,0.12)] text-[#7AB8FF] border border-[rgba(122,184,255,0.25)]"
                          title="Telegram-linked — will be pinged on mention"
                        >
                          TG
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={taRef}
              value={body}
              onChange={(e) => {
                const v = e.target.value;
                setBody(v);
                // Detect "@word" before the caret to trigger autocomplete.
                const caret = e.target.selectionStart || v.length;
                const before = v.slice(0, caret);
                const m = before.match(/(?:^|\s)@([\w][\w.\-]{0,40})$/);
                if (m) {
                  setMention({ start: caret - m[1].length, query: m[1] });
                } else {
                  setMention(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && mention) {
                  setMention(null);
                  e.stopPropagation();
                  return;
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={2}
              placeholder="Write a comment… use @name to mention. ⌘/Ctrl+Enter to send"
              className="mm-input text-xs flex-1 resize-none"
              data-testid="comment-input"
            />
            <button
              onClick={add}
              disabled={busy || !body.trim()}
              className="mm-btn-primary text-xs px-3 py-2 disabled:opacity-40 flex items-center gap-1"
              data-testid="comment-send"
            >
              <Send size={12} /> Send
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
