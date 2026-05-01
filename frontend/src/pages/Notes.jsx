import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import { Plus, Search, Pin, PinOff, Trash2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

const TAG_OPTIONS = ["work", "personal", "idea", "reminder", "health", "finance"];

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [filterTag, setFilterTag] = useState("");

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (filterTag) params.tag = filterTag;
    const { data } = await api.get("/notes", { params });
    setNotes(data);
    if (!selected && data.length) setSelected(data[0]);
    if (selected) {
      const fresh = data.find((n) => n.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, filterTag]);

  const allTags = useMemo(() => {
    const s = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    TAG_OPTIONS.forEach((t) => s.add(t));
    return Array.from(s);
  }, [notes]);

  const create = async () => {
    const { data } = await api.post("/notes", { title: "New note", body: "", tags: [] });
    setNotes((s) => [data, ...s]);
    setSelected(data);
  };

  const save = async (patch) => {
    if (!selected) return;
    const { data } = await api.patch(`/notes/${selected.id}`, patch);
    setSelected(data);
    setNotes((s) => s.map((n) => (n.id === data.id ? data : n)));
  };

  const remove = async (id) => {
    await api.delete(`/notes/${id}`);
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    setSelected(remaining[0] || null);
  };

  const togglePin = () => selected && save({ pinned: !selected.pinned });

  const toggleTag = (t) => {
    const cur = selected?.tags || [];
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    save({ tags: next });
  };

  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);

  return (
    <div className="space-y-6 mm-fade-in" data-testid="notes-page">
      <SectionTitle
        subtitle="Thoughts"
        title="Notes & Affirmations"
        right={
          <button onClick={create} className="mm-btn-primary text-sm flex items-center gap-1.5" data-testid="new-note-btn">
            <Plus size={14} /> New note
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Left list */}
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 px-2">
              <Search size={14} className="text-white/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all notes"
                className="bg-transparent outline-none text-sm w-full"
                data-testid="notes-search"
              />
            </div>
          </Card>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterTag("")}
                className={`mm-chip ${!filterTag ? "bg-white text-black border-transparent" : ""}`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t === filterTag ? "" : t)}
                  className={`mm-chip ${filterTag === t ? "bg-white text-black border-transparent" : ""}`}
                  data-testid={`filter-tag-${t}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState title="No notes" hint="Capture thoughts, ideas, reminders. Pin important ones to the dashboard." />
          ) : (
            <Card className="p-0 overflow-hidden max-h-[68vh] overflow-y-auto">
              {[...pinned, ...others].map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition ${
                    selected?.id === n.id ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                  }`}
                  data-testid="note-list-item"
                >
                  <div className="flex items-center gap-2">
                    {n.pinned && <Pin size={10} className="text-white/70" />}
                    <div className="text-sm truncate text-white/90">{n.title || "Untitled"}</div>
                  </div>
                  <div className="text-xs text-white/45 truncate mt-1">
                    {(n.body || "").slice(0, 80) || "—"}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {(n.tags || []).slice(0, 4).map((t) => (
                      <span key={t} className="text-[9px] uppercase tracking-[0.2em] text-white/40">
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </Card>
          )}
        </div>

        {/* Editor */}
        <Card className="p-6 min-h-[70vh] flex flex-col" data-testid="note-editor">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              Select or create a note to start writing.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <input
                  value={selected.title}
                  onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                  onBlur={(e) => save({ title: e.target.value })}
                  placeholder="Title"
                  className="flex-1 bg-transparent outline-none mm-font-display text-2xl"
                  data-testid="note-title-input"
                />
                <button onClick={togglePin} className="text-white/50 hover:text-white transition" title="Pin" data-testid="note-pin-toggle">
                  {selected.pinned ? <Pin size={16} /> : <PinOff size={16} />}
                </button>
                <button onClick={() => remove(selected.id)} className="text-white/50 hover:text-white transition" title="Delete" data-testid="note-delete">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                <TagIcon size={12} className="text-white/40" />
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`mm-chip ${(selected.tags || []).includes(t) ? "bg-white text-black border-transparent" : ""}`}
                    data-testid={`note-tag-${t}`}
                  >
                    #{t}
                  </button>
                ))}
              </div>

              <textarea
                value={selected.body}
                onChange={(e) => setSelected({ ...selected, body: e.target.value })}
                onBlur={(e) => save({ body: e.target.value })}
                placeholder="Start writing..."
                className="flex-1 bg-transparent outline-none mm-font-body text-base leading-relaxed resize-none"
                data-testid="note-body-input"
              />

              <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/35 text-right">
                Auto-saved · {new Date(selected.updated_at).toLocaleString()}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
