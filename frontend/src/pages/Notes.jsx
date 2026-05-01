import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import {
  Plus, Search, Pin, PinOff, Trash2, Tag as TagIcon, Image as ImageIcon, Upload,
} from "lucide-react";
import { toast } from "sonner";

const TAG_OPTIONS = ["work", "personal", "idea", "reminder", "health", "finance"];

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [selected, setSelected] = useState(null);
  const [images, setImages] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const imgRef = useRef(null);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [q, filterTag]);

  useEffect(() => {
    if (selected) {
      api.get(`/notes/${selected.id}/images`).then(({ data }) => setImages(data));
    } else {
      setImages([]);
    }
  }, [selected?.id]);

  const allTags = useMemo(() => {
    const s = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    TAG_OPTIONS.forEach((t) => s.add(t));
    return Array.from(s);
  }, [notes]);

  const insertOne = async (row) => {
    await api.post("/notes", {
      title: row.title || "",
      body: row.body || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
    });
  };

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

  const uploadImage = async (file) => {
    if (!file || !selected) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/notes/${selected.id}/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImages((s) => [...s, data]);
      toast.success("Image added");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      if (imgRef.current) imgRef.current.value = "";
    }
  };

  const deleteImage = async (iid) => {
    if (!selected) return;
    await api.delete(`/notes/${selected.id}/images/${iid}`);
    setImages((s) => s.filter((i) => i.id !== iid));
  };

  const describe = (r) =>
    `${r.title || "(untitled)"}${r.tags?.length ? " · #" + r.tags.join(" #") : ""}${
      r.body ? " · " + r.body.slice(0, 60) + (r.body.length > 60 ? "…" : "") : ""
    }`;

  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);

  return (
    <div className="space-y-6 mm-fade-in" data-testid="notes-page">
      <SectionTitle
        subtitle="Thoughts"
        title="Notes & Affirmations"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="bulk-add-open"
            >
              <Upload size={12} /> Bulk add
            </button>
            <button
              onClick={create}
              className="mm-btn-primary text-sm flex items-center gap-1.5"
              data-testid="new-note-btn"
            >
              <Plus size={14} /> New note
            </button>
          </div>
        }
      />

      <AiAddBar
        kind="note"
        placeholder="e.g. Idea — start a Sunday review ritual every week #personal"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 px-2">
              <Search size={14} className="text-[#B7A98A]/60" />
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
                className={`mm-chip ${!filterTag ? "mm-chip-gold" : ""}`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t === filterTag ? "" : t)}
                  className={`mm-chip ${filterTag === t ? "mm-chip-gold" : ""}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState title="No notes" hint="Capture thoughts. Pin important ones to the dashboard." />
          ) : (
            <Card className="p-0 overflow-hidden max-h-[68vh] overflow-y-auto">
              {[...pinned, ...others].map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[rgba(201,169,97,0.08)] transition ${
                    selected?.id === n.id ? "bg-[rgba(201,169,97,0.08)]" : "hover:bg-[rgba(201,169,97,0.04)]"
                  }`}
                  data-testid="note-list-item"
                >
                  <div className="flex items-center gap-2">
                    {n.pinned && <Pin size={10} className="mm-text-gold-bright" />}
                    <div className="text-sm truncate mm-text-gold-bright">
                      {n.title || "Untitled"}
                    </div>
                  </div>
                  <div className="text-xs text-[#B7A98A]/55 truncate mt-1">
                    {(n.body || "").slice(0, 80) || "—"}
                  </div>
                </button>
              ))}
            </Card>
          )}
        </div>

        <Card className="p-6 min-h-[70vh] flex flex-col" data-testid="note-editor">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[#B7A98A]/55 text-sm">
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
                  className="flex-1 bg-transparent outline-none mm-font-display text-2xl mm-text-gold-bright"
                  data-testid="note-title-input"
                />
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                  data-testid="note-image-input"
                />
                <button
                  onClick={() => imgRef.current?.click()}
                  className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
                  title="Add image"
                  data-testid="note-add-image"
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  onClick={togglePin}
                  className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
                  data-testid="note-pin-toggle"
                >
                  {selected.pinned ? <Pin size={16} /> : <PinOff size={16} />}
                </button>
                <button
                  onClick={() => remove(selected.id)}
                  className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
                  data-testid="note-delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                <TagIcon size={12} className="text-[#B7A98A]/55" />
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`mm-chip ${(selected.tags || []).includes(t) ? "mm-chip-gold" : ""}`}
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

              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((im) => (
                    <div
                      key={im.id}
                      className="relative group rounded-lg overflow-hidden border border-[rgba(201,169,97,0.18)]"
                      data-testid="note-image"
                    >
                      <img
                        src={im.data_url}
                        alt={im.name}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        onClick={() => deleteImage(im.id)}
                        className="absolute top-1 right-1 bg-black/60 backdrop-blur p-1 rounded text-[#E4C98C] opacity-0 group-hover:opacity-100 transition"
                        data-testid="note-image-delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/45 text-right">
                Auto-saved · {new Date(selected.updated_at).toLocaleString()}
              </div>
            </>
          )}
        </Card>
      </div>

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind="note"
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />
    </div>
  );
}
