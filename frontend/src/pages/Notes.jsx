import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import AiAddBar from "@/components/AiAddBar";
import BulkAddDialog from "@/components/BulkAddDialog";
import {
  Plus, Search, Pin, PinOff, Trash2, Tag as TagIcon, Image as ImageIcon, Upload, BellRing,
} from "lucide-react";
import { toast } from "sonner";
import ReminderDialog from "@/components/ReminderDialog";
import { capWords } from "@/lib/format";

const TAG_OPTIONS = []; // No presets — user creates their own via "+ Custom" chip

const NOTE_COLUMNS = [
  { key: "title", label: "Title", type: "text", width: "1fr" },
  { key: "body", label: "Body", type: "text", width: "2fr" },
  { key: "list_title", label: "Add to list", type: "text", width: "1fr" },
  { key: "items_preview", label: "Items", type: "text", width: "1.5fr" },
];

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [selected, setSelected] = useState(null);
  const [images, setImages] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reminderFor, setReminderFor] = useState(null);
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

  // Existing notes whose body starts with bullets ("• ") or contains hyphen list lines
  // are surfaced as one-tap "Add to <Title>" pills above the AI bar.
  const listTitles = useMemo(() => {
    return notes
      .filter((n) => /^\s*[-•*]/m.test(n.body || ""))
      .map((n) => n.title || "")
      .filter(Boolean);
  }, [notes]);
  const noteQuickTags = useMemo(
    () => Array.from(new Set([...listTitles, ...allTags])),
    [listTitles, allTags],
  );

  const insertOne = async (row) => {
    // v2.1: AI may return kind='note' OR signal list-append intent via list_title/list_tag + items
    const listTitle = row.list_title || row.list_name || null;
    const listTag = row.list_tag || null;
    // Accept items as an array OR a comma/newline-separated string (when user edits the preview cell).
    let items = null;
    if (Array.isArray(row.items)) items = row.items;
    else if (typeof row.items === "string" && row.items.trim()) items = [row.items.trim()];
    else if (typeof row.items_preview === "string" && row.items_preview.trim()) {
      items = row.items_preview.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    }
    if ((listTitle || listTag) && items && items.length) {
      await api.post("/notes/append-list", {
        title_hint: listTitle,
        tag: listTag,
        items,
        create_if_missing: true,
      });
      return;
    }
    await api.post("/notes", {
      title: row.title || "",
      body: row.body || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
    });
  };

  // Transform AI-parsed rows into a preview-friendly shape (items[] → comma string).
  const decorateForPreview = (rows) =>
    rows.map((r) => ({
      ...r,
      items_preview: Array.isArray(r.items) ? r.items.join(", ") : (r.items_preview || ""),
    }));

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
            <span className="mm-chip" data-testid="notes-count-chip">
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setBulkOpen(true)}
              className="mm-btn-ghost text-xs flex items-center gap-1.5"
              data-testid="bulk-add-open"
            >
              <Upload size={12} /> Bulk add
            </button>
          </div>
        }
      />
      <p className="text-xs sm:text-sm text-[#B7A98A]/65 -mt-3 max-w-2xl" data-testid="notes-description">
        Your second brain — quick thoughts, research, ideas. Tag them so they find you later.
      </p>

      <AiAddBar
        kind="note"
        placeholder="e.g. add butter to shopping list #Personal"
        columns={NOTE_COLUMNS}
        describe={describe}
        quickTags={noteQuickTags}
        quickTagPrefix=""
        decorateRows={decorateForPreview}
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
                placeholder="Search notes & tags"
                className="bg-transparent outline-none text-sm w-full"
                data-testid="notes-search"
              />
              <button
                onClick={create}
                className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition shrink-0"
                title="New note"
                data-testid="new-note-btn"
              >
                <Plus size={16} />
              </button>
            </div>
          </Card>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="notes-tag-list">
              <button
                onClick={() => setFilterTag("")}
                className={`mm-chip ${!filterTag ? "mm-chip-gold" : ""}`}
                data-testid="notes-tag-all"
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t === filterTag ? "" : t)}
                  className={`mm-chip ${filterTag === t ? "mm-chip-gold" : ""}`}
                  data-testid={`notes-tag-${t}`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => {
                  const name = window.prompt("New tag name?", "");
                  if (name && name.trim() && selected) {
                    const tag = name.trim().toLowerCase();
                    const next = Array.from(new Set([...(selected.tags || []), tag]));
                    save({ tags: next });
                    setFilterTag(tag);
                  } else if (!selected) {
                    toast("Select a note first to add a tag.");
                  }
                }}
                className="mm-chip"
                data-testid="notes-tag-create"
                title="Create a new tag and add it to the selected note"
              >
                + Custom
              </button>
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
                  onClick={() => setReminderFor({
                    title: selected.title || "Note reminder",
                    notes: (selected.body || "").slice(0, 180),
                    source_page: "notes",
                    source_context: { id: selected.id, title: selected.title, tags: selected.tags || [] },
                  })}
                  className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
                  title="Set reminder for this note/list"
                  data-testid="note-reminder"
                >
                  <BellRing size={16} />
                </button>
                <button
                  onClick={() => remove(selected.id)}
                  className="text-[#B7A98A]/65 hover:text-[#E4C98C] transition"
                  data-testid="note-delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {(selected.tags || []).length > 0 && (
                <div className="flex items-center gap-1.5 mb-4 flex-wrap" data-testid="note-tag-chips">
                  {(selected.tags || []).map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className="mm-chip mm-chip-gold"
                      title="Click to remove this tag from the note"
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}

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
        columns={NOTE_COLUMNS}
        describe={describe}
        onConfirm={async (rows) => {
          for (const r of rows) await insertOne(r);
          await load();
        }}
      />

      <ReminderDialog
        open={!!reminderFor}
        onClose={() => setReminderFor(null)}
        defaults={reminderFor || {}}
      />
    </div>
  );
}
