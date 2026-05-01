import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/Primitives";
import { FileText, Sparkles, Send, Download, Upload, Trash2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const load = async () => {
    const { data } = await api.get("/documents/templates");
    setTemplates(data.templates || []);
  };
  useEffect(() => {
    load();
  }, []);
  return { templates, reload: load };
}

function FieldInput({ field, value, onChange }) {
  const common = "mm-input text-sm";
  if (field.type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={common}
        rows={2}
        placeholder={field.placeholder || ""}
        data-testid={`field-${field.key}`}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={common}
        placeholder={field.placeholder || ""}
        data-testid={`field-${field.key}`}
      />
    );
  }
  if (field.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={common}
        data-testid={`field-${field.key}`}
      />
    );
  }
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={common}
      placeholder={field.placeholder || ""}
      data-testid={`field-${field.key}`}
    />
  );
}

function LineItemsEditor({ value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const update = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };
  const add = () =>
    onChange([...items, { description: "", hsn: "", quantity: 1, unit_price: 0 }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-2" data-testid="line-item-row">
          <input
            className="mm-input text-sm col-span-5"
            placeholder="Description"
            value={it.description || ""}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <input
            className="mm-input text-sm col-span-2"
            placeholder="HSN"
            value={it.hsn || ""}
            onChange={(e) => update(i, { hsn: e.target.value })}
          />
          <input
            type="number"
            className="mm-input text-sm col-span-2"
            placeholder="Qty"
            value={it.quantity ?? ""}
            onChange={(e) => update(i, { quantity: Number(e.target.value) })}
          />
          <input
            type="number"
            className="mm-input text-sm col-span-2"
            placeholder="Unit ₹"
            value={it.unit_price ?? ""}
            onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
          />
          <button
            onClick={() => remove(i)}
            className="text-[#B7A98A]/60 hover:text-[#E4C98C]"
            data-testid="line-item-remove"
          >
            <Minus size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="mm-btn-ghost text-xs flex items-center gap-1.5"
        data-testid="line-item-add"
      >
        <Plus size={12} /> Add line item
      </button>
    </div>
  );
}

export default function Documents() {
  const { templates, reload } = useTemplates();
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [tgLinked, setTgLinked] = useState(false);

  useEffect(() => {
    api.get("/telegram/status").then(({ data }) => setTgLinked(!!data.linked));
  }, []);

  useEffect(() => {
    if (!selectedId && templates.length) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  const selected = templates.find((t) => t.id === selectedId);

  const setField = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const download = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.post(
        "/documents/generate",
        { template_id: selected.id, data },
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const cd = res.headers["content-disposition"] || "";
      const match = cd.match(/filename="(.+?)"/);
      const name = match?.[1] || (selected.kind === "invoice" ? "invoice.pdf" : "receipt.pdf");
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded");
    } catch (e) {
      toast.error("Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const shareTg = async () => {
    if (!tgLinked) {
      toast.error("Connect Telegram in Settings first");
      return;
    }
    if (!selected) return;
    setBusy(true);
    try {
      await api.post("/documents/share-telegram", {
        template_id: selected.id,
        data,
        caption: `${selected.name} · generated by Mind Matters`,
      });
      toast.success("Sent to Telegram");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadTemplate = async (file) => {
    if (!file) return;
    const name = window.prompt("Template name?", file.name.replace(/\.docx$/i, ""));
    if (!name) return;
    const kind = window.prompt("Kind? (invoice / receipt / other)", "invoice") || "other";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("kind", kind);
    try {
      await api.post("/documents/templates/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Template uploaded");
      await reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    await api.delete(`/documents/templates/${id}`);
    await reload();
    if (selectedId === id) setSelectedId(null);
    setData({});
    toast.success("Deleted");
  };

  return (
    <div className="space-y-6 mm-fade-in" data-testid="documents-page">
      <SectionTitle
        subtitle="Generator"
        title="Documents"
        right={
          <>
            <input
              type="file"
              accept=".docx"
              ref={fileRef}
              className="hidden"
              onChange={(e) => uploadTemplate(e.target.files?.[0])}
              data-testid="template-upload-input"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="mm-btn-ghost text-xs flex items-center gap-2"
              data-testid="upload-template-btn"
            >
              <Upload size={12} /> Upload .docx template
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Template list */}
        <Card className="p-3" data-testid="template-list">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/70 px-2 py-2">
            Templates
          </div>
          <div className="space-y-1">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center justify-between rounded-lg transition ${
                  selectedId === t.id
                    ? "bg-[rgba(201,169,97,0.12)] border border-[rgba(201,169,97,0.35)]"
                    : "border border-transparent hover:bg-[rgba(201,169,97,0.05)]"
                }`}
              >
                <button
                  onClick={() => {
                    setSelectedId(t.id);
                    setData({});
                  }}
                  className="flex-1 text-left px-3 py-2.5 text-sm"
                  data-testid={`template-${t.id}`}
                >
                  <div className={selectedId === t.id ? "mm-text-gold-bright" : "text-[#E4C98C]/85"}>
                    {t.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#B7A98A]/50 mt-1">
                    {t.kind}
                    {t.builtin ? " · built-in" : " · custom"}
                  </div>
                </button>
                {!t.builtin && (
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="px-3 opacity-0 group-hover:opacity-100 text-[#B7A98A]/70 hover:text-[#E4C98C]"
                    data-testid="template-delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Editor */}
        <Card className="p-6" data-testid="template-editor">
          {!selected ? (
            <EmptyState
              title="Select a template"
              hint="Pick a built-in or upload your own .docx with {{placeholders}}."
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#B7A98A]/60">
                    {selected.kind}
                  </div>
                  <div className="mm-font-display text-2xl mm-text-gold-bright mt-1">
                    {selected.name}
                  </div>
                </div>
                <FileText size={20} className="mm-text-gold opacity-60" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(selected.required_fields || []).map((f) => (
                  <div
                    key={f.key}
                    className={f.type === "items" || f.type === "textarea" ? "md:col-span-2" : ""}
                  >
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#B7A98A]/70 mb-1.5">
                      {f.label}
                    </div>
                    {f.type === "items" ? (
                      <LineItemsEditor
                        value={data[f.key]}
                        onChange={(v) => setField(f.key, v)}
                      />
                    ) : (
                      <FieldInput
                        field={f}
                        value={data[f.key]}
                        onChange={(v) => setField(f.key, v)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mm-gold-line my-6" />

              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  onClick={download}
                  disabled={busy}
                  className="mm-btn-ghost text-sm flex items-center gap-2 disabled:opacity-50"
                  data-testid="doc-download-btn"
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={shareTg}
                  disabled={busy || !tgLinked}
                  className="mm-btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                  data-testid="doc-share-telegram-btn"
                  title={tgLinked ? "Send PDF to Telegram" : "Link Telegram in Settings first"}
                >
                  <Send size={14} /> {tgLinked ? "Share via Telegram" : "Telegram not linked"}
                </button>
              </div>
              <div className="mt-4 text-[11px] text-[#B7A98A]/50 flex items-start gap-2">
                <Sparkles size={11} className="mt-0.5" />
                <span>
                  Tip: ask the AI chat "create a donation receipt for Brinda, ₹11,000 for
                  education fund" and it will prefill this page.
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
