"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Save, Trash2, Copy, Loader2, Braces, AlertTriangle, Eye, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/roles";
import { useAuth } from "@/lib/auth";

const CATEGORIES = ["welcome", "invitation", "reminder", "payment", "dunning", "thank_you", "custom"];

function extractVars(...texts: (string | undefined)[]): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  for (const t of texts) {
    if (!t) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) set.add(m[1]);
  }
  return Array.from(set);
}

const BLANK = {
  name: "",
  subject: "",
  html_body: "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden\">\n  <div style=\"background:#0a1628;padding:24px;text-align:center\">\n    <h1 style=\"color:#c9a84c;margin:0\">RoyalEntry</h1>\n  </div>\n  <div style=\"padding:24px\">\n    <h2>{{subject_heading}}</h2>\n    <p>Hello {{user_name}},</p>\n    <p>{{message}}</p>\n  </div>\n</div>",
  text_body: "",
  category: "custom",
  is_active: true,
};

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canView = isPlatformAdmin(user?.role);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Editor state
  const [name, setName] = useState(BLANK.name);
  const [subject, setSubject] = useState(BLANK.subject);
  const [html, setHtml] = useState(BLANK.html_body);
  const [text, setText] = useState(BLANK.text_body);
  const [category, setCategory] = useState(BLANK.category);
  const [isActive, setIsActive] = useState(true);
  const [isSystem, setIsSystem] = useState(false);
  const [dirty, setDirty] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement | null>(null);

  // Preview state
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["platform-templates"],
    queryFn: async () => (await api.get("/platform/templates")).data.data,
    enabled: canView,
  });

  const filtered = useMemo(() => {
    return (templates as any[]).filter((t) => {
      const q = search.toLowerCase();
      const okSearch = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
      const okCat = !filterCat || t.category === filterCat;
      return okSearch && okCat;
    });
  }, [templates, search, filterCat]);

  const loadTemplate = (t: any) => {
    setSelectedId(t.id);
    setName(t.name); setSubject(t.subject); setHtml(t.html_body);
    setText(t.text_body ?? ""); setCategory(t.category); setIsActive(t.is_active);
    setIsSystem(t.is_system); setDirty(false); setPreviewError("");
  };

  const startNew = () => {
    setSelectedId(null);
    setName(BLANK.name); setSubject("Welcome {{user_name}}!"); setHtml(BLANK.html_body);
    setText(""); setCategory("custom"); setIsActive(true); setIsSystem(false);
    setDirty(false); setPreviewError("");
  };

  // Debounced live preview
  useEffect(() => {
    if (!canView) return;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.post("/platform/templates/preview", {
          subject, html_body: html, text_body: text || undefined,
        });
        setPreviewHtml(r.data.data.html);
        setPreviewSubject(r.data.data.subject);
        setPreviewError("");
      } catch (e: any) {
        setPreviewError(e?.response?.data?.error?.message ?? "Preview failed");
      } finally {
        setPreviewing(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [subject, html, text, canView]);

  const mark = () => setDirty(true);

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      selectedId ? api.put(`/platform/templates/${selectedId}`, payload) : api.post("/platform/templates", payload),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["platform-templates"] });
      if (!selectedId && r.data?.data?.id) setSelectedId(r.data.data.id);
      setDirty(false);
      setIsSystem(false);
      toast.success("Template saved");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-templates"] });
      setDeleteConfirm(false); startNew();
      toast.success("Template deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to delete"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/templates/${id}/duplicate`),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["platform-templates"] });
      toast.success("Duplicated — editing the copy");
      if (r.data?.data?.id) {
        // load the new copy
        api.get(`/platform/templates/${r.data.data.id}`).then((res) => loadTemplate(res.data.data));
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to duplicate"),
  });

  const handleSave = () => {
    if (!name.trim() || !subject.trim() || !html.trim()) {
      toast.error("Name, subject and HTML body are required");
      return;
    }
    saveMutation.mutate({
      name, subject, html_body: html,
      text_body: text || undefined,
      category, is_active: isActive,
    });
  };

  const insertVar = (v: string) => {
    const ta = htmlRef.current;
    const token = `{{${v}}}`;
    if (!ta) { setHtml((h) => h + token); mark(); return; }
    const start = ta.selectionStart ?? html.length;
    const end = ta.selectionEnd ?? start;
    const next = html.slice(0, start) + token + html.slice(end);
    setHtml(next); mark();
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  };

  const detected = useMemo(() => extractVars(subject, html, text), [subject, html, text]);

  if (!canView) {
    return (
      <div className="py-20 text-center">
        <p className="font-semibold text-slate-700">Access Denied</p>
        <p className="text-sm text-slate-500">Platform admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
          <p className="text-sm text-slate-500">Handlebars templates with live preview — system templates are protected</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> New template</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        {/* ── Left: template list ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <Input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No templates</p>
            ) : (
              filtered.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    selectedId === t.id ? "border-gold-400 bg-gold-50/60" : "border-slate-200 bg-white hover:border-gold-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                    {t.is_system && <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{t.subject}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge label={t.category} variant="blue" />
                    <Badge label={t.is_active ? "active" : "inactive"} variant={t.is_active ? "green" : "slate"} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: editor + preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card title={selectedId ? `Edit: ${name || "Untitled"}` : "New Template"} action={
            <div className="flex items-center gap-2">
              {isSystem && <Badge label="System (read-protected)" variant="gold" />}
              {isSystem && (
                <Button size="sm" variant="outline" onClick={() => selectedId && duplicateMutation.mutate(selectedId)} isLoading={duplicateMutation.isPending}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
              )}
              {selectedId && !isSystem && (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
              <Button size="sm" onClick={handleSave} isLoading={saveMutation.isPending} disabled={!dirty && !!selectedId}>
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          }>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Input label="Name *" value={name} onChange={(e) => { setName(e.target.value); mark(); }} />
                <Input label="Subject *" value={subject} onChange={(e) => { setSubject(e.target.value); mark(); }} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Category" value={category} onChange={(e) => { setCategory(e.target.value); mark(); }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <label className="flex items-end gap-2 pb-2">
                    <input type="checkbox" className="h-4 w-4 rounded accent-gold-500" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); mark(); }} />
                    <span className="text-sm text-slate-600">Active</span>
                  </label>
                </div>
                <Input label="Plain-text body (optional)" value={text} onChange={(e) => { setText(e.target.value); mark(); }} />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Braces className="h-3.5 w-3.5" /> Detected variables ({detected.length}) — click to insert
                </label>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {detected.length === 0 && <span className="text-xs text-slate-400">Use {"{{variable}}"} syntax in subject or HTML.</span>}
                  {detected.map((v) => (
                    <button key={v} type="button" onClick={() => insertVar(v)}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 transition hover:bg-gold-100 hover:text-gold-800">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">HTML Body *</label>
                <textarea
                  ref={htmlRef}
                  value={html}
                  onChange={(e) => { setHtml(e.target.value); mark(); }}
                  rows={18}
                  className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs leading-relaxed outline-none focus:border-gold-400"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Live preview</span>
                  {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-600" />}
                </label>
                <p className="mb-1 truncate text-xs text-slate-400">Subject: {previewSubject || "—"}</p>
                {previewError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {previewError}
                  </div>
                ) : (
                  <iframe
                    title="Template preview"
                    sandbox=""
                    srcDoc={previewHtml}
                    className="h-[420px] w-full rounded-lg border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete Template" size="sm">
        <p className="text-sm text-slate-600">Delete “{name}”? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => selectedId && deleteMutation.mutate(selectedId)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
