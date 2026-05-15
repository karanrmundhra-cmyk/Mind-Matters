import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, MessageSquare, Send, Trash2 } from "lucide-react";

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
      load();
      setTimeout(() => taRef.current?.focus(), 80);
    }
  }, [open, load]);

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
                  {c.body}
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="px-5 py-3 border-t border-[rgba(201,169,97,0.15)] bg-[rgba(0,0,0,0.4)]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={taRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={2}
              placeholder="Write a comment… ⌘/Ctrl+Enter to send"
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
