"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Braces, Eye, FileText, Loader2, Pencil, Plus, Save,
  ShieldCheck, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Badge, Button, Card, Input, Modal, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/roles";
import { useAuth } from "@/lib/auth";

type Kind = "invoice" | "receipt" | "report" | "checkin_card" | "invitation";

const KINDS: { value: Kind; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "report", label: "Report" },
  { value: "checkin_card", label: "Check-in card" },
  { value: "invitation", label: "Invitation" },
];

type Template = {
  id: string;
  org_id?: string | null;
  kind: Kind | string;
  name: string;
  subject?: string | null;
  body_html: string;
  variables_json?: unknown;
  is_active: boolean;
  is_system: boolean;
};

type SavePayload = {
  kind: Kind;
  name: string;
  subject?: string;
  body_html: string;
  variables: string[];
  is_active: boolean;
};

const SAMPLE_VARS: Record<string, string> = {
  invoice_number: "INV-2026-00123",
  receipt_number: "RCP-2026-00123",
  organization_name: "RoyalEntry Events",
  company_name: "Example Company Ltd",
  event_title: "Annual Gala 2026",
  guest_name: "Juma Mganga",
  customer_name: "Example Company Ltd",
  user_name: "Juma Mganga",
  issued_at: "25 November 2026",
  date: "25 November 2026",
  amount_tsh: "1,250,000",
  tax_amount_tsh: "212,500",
  total_tsh: "1,462,500",
  tin: "123456789",
  subject: "Invoice INV-2026-00123",
  subject_heading: "Invoice",
  message: "Please find your invoice attached.",
  event_date: "25 December 2026",
  venue: "Dar es Salaam",
  table_number: "12",
  package_name: "Gold Package",
};

function extractVars(...texts: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  for (const text of texts) {
    if (!text) continue;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) set.add(match[1]);
  }
  return Array.from(set);
}

function withSamples(html: string): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    SAMPLE_VARS[key] ?? `[${key}]`
  );
}

function storedVars(template: Template): string[] {
  const raw = template.variables_json;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}

const BLANK_BODY = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#0a1628;padding:24px;text-align:center">
    <h1 style="color:#c9a84c;margin:0">RoyalEntry</h1>
  </div>
  <div style="padding:24px">
    <h2>{{subject_heading}}</h2>
    <p>Dear {{company_name}},</p>
    <p>Invoice <strong>{{invoice_number}}</strong> for {{event_title}} is ready.</p>
    <p>Amount: TZS {{amount_tsh}} · VAT: TZS {{tax_amount_tsh}} · TIN: {{tin}}</p>
  </div>
</div>`;

export default function DocumentTemplatesSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManageSystem = isPlatformAdmin(user?.role);

  const [kind, setKind] = useState<Kind>("invoice");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(BLANK_BODY);
  const [variablesText, setVariablesText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSystem, setIsSystem] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery<Template[]>({
    queryKey: ["document-templates", kind],
    queryFn: async () =>
      (await api.get("/settings/document-templates", { params: { kind } })).data.data,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SavePayload) =>
      editingId
        ? api.put(`/settings/document-templates/${editingId}`, payload)
        : api.post("/settings/document-templates", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      setModalOpen(false);
      toast.success("Document template saved");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error?.message ?? "Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/document-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      setDeleteTarget(null);
      toast.success("Document template deleted");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error?.message ?? "Failed to delete template"),
  });

  const startNew = () => {
    setEditingId(null);
    setName("");
    setSubject("");
    setBodyHtml(BLANK_BODY);
    setVariablesText("");
    setIsActive(true);
    setIsSystem(false);
    setModalOpen(true);
  };

  const edit = (template: Template) => {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject ?? "");
    setBodyHtml(template.body_html);
    setVariablesText(storedVars(template).join(", "));
    setIsActive(template.is_active);
    setIsSystem(!!template.is_system);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !bodyHtml.trim()) {
      toast.error("Name and HTML body are required");
      return;
    }
    saveMutation.mutate({
      kind,
      name: name.trim(),
      subject: subject.trim() || undefined,
      body_html: bodyHtml.trim(),
      variables: variablesText.split(",").map((value) => value.trim()).filter(Boolean),
      is_active: isActive,
    });
  };

  const previewHtml = useMemo(() => withSamples(bodyHtml), [bodyHtml]);
  const detected = useMemo(() => extractVars(subject, bodyHtml), [subject, bodyHtml]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Templates</h1>
          <p className="text-sm text-slate-500">
            Editable HTML documents for invoices, receipts, reports, cards and invitations
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKind(option.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-semibold transition",
              kind === option.value
                ? "border-gold-400 bg-gold-50 text-gold-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-gold-300"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          System templates are shared across all accounts. Editing one changes the document for
          every organization — create an account-specific template if you only want to change your own.
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Could not load document templates.
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No templates for this kind yet.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> Create one
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const lockedSystem = !!template.is_system && !canManageSystem;
            return (
              <Card
                key={template.id}
                title={template.name}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => edit(template)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      disabled={lockedSystem}
                      title={
                        lockedSystem
                          ? "System templates can only be deleted by platform admins"
                          : "Delete template"
                      }
                      onClick={() => setDeleteTarget(template)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                }
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={template.kind} variant="blue" />
                    <Badge
                      label={template.is_active ? "active" : "inactive"}
                      variant={template.is_active ? "green" : "slate"}
                    />
                    {template.is_system && (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                        <Badge label="System" variant="gold" />
                      </span>
                    )}
                  </div>
                  {template.subject && (
                    <p className="break-words text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">Subject: </span>
                      {template.subject}
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
                    {template.body_html}
                  </pre>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit document template" : "New document template"}
        size="lg"
      >
        <div className="space-y-4">
          {isSystem && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                This is a system template shared across all accounts. Changes here affect every
                organization on the platform.
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name *"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Invoice — Gold"
            />
            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <Input
            label="Variables (comma-separated)"
            value={variablesText}
            onChange={(event) => setVariablesText(event.target.value)}
            placeholder="invoice_number, company_name, amount_tsh"
            hint="Use {{variable}} in the HTML body. Unknown variables show as [variable] in the preview."
          />

          {detected.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Braces className="h-3.5 w-3.5" /> Detected:
              {detected.map((variable) => (
                <code key={variable} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                  {`{{${variable}}}`}
                </code>
              ))}
            </div>
          )}

          <Textarea
            label="HTML body *"
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            rows={12}
            className="font-mono text-xs leading-relaxed"
          />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-gold-500"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Active
          </label>

          <div>
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Eye className="h-3.5 w-3.5" /> Live preview (sample values)
            </label>
            <iframe
              title="preview"
              sandbox=""
              srcDoc={previewHtml}
              className="w-full h-64 border rounded"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5" /> Save template
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete document template"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete “{deleteTarget?.name}”? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
