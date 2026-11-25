"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, Edit2, Eye, MessageSquare, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { Badge, Button, Card, Input, Modal, Textarea } from "@/components/ui";

interface SmsTemplate {
  id: string | number;
  name: string;
  channel_kind: string;
  body: string;
  subject?: string | null;
}

const BODY_ID = "sms-template-body";
const SPECIAL_NAMES = ["invitation", "checkin_card"];
const VARIABLES = [
  "{{guest_name}}",
  "{{event_title}}",
  "{{event_date}}",
  "{{venue}}",
  "{{pledge_range}}",
  "{{invitation_link}}",
  "{{check_in_link}}",
  "{{entry_code}}",
  "{{qr_url}}",
];

const SAMPLE_VARIABLES = {
  guest_name: "Amina Hassan",
  event_title: "RoyalEntry Celebration",
  event_date: "15 March 2026",
  venue: "Grand Hall, Dar es Salaam",
  pledge_range: "TSh 50,000 – 200,000",
  invitation_link: "https://royalentry.app/invitation/demo",
  check_in_link: "https://royalentry.app/checkin/demo",
  entry_code: "RE-2026-0042",
  qr_url: "https://royalentry.app/qr/demo",
  card_url: "https://royalentry.app/invitation/demo",
};

function smsInfo(body: string) {
  const unicode = /[^\x00-\x7F]/.test(body);
  const singleLimit = unicode ? 70 : 160;
  const concatenatedLimit = unicode ? 67 : 153;
  const length = body.length;
  const segments =
    length === 0 ? 0 : length <= singleLimit ? 1 : Math.ceil(length / concatenatedLimit);
  return { unicode, singleLimit, concatenatedLimit, length, segments };
}

function errorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.error?.message ??
    error?.response?.data?.message ??
    fallback
  );
}

function TemplateActions({
  template,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  template: SmsTemplate;
  onEdit: (t: SmsTemplate) => void;
  onPreview: (t: SmsTemplate) => void;
  onDuplicate: (t: SmsTemplate) => void;
  onDelete: (t: SmsTemplate) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => onEdit(template)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-900" title="Edit"><Edit2 className="h-4 w-4" /></button>
      <button onClick={() => onPreview(template)} className="rounded p-1.5 text-gold-700 hover:bg-gold-50" title="Preview"><Eye className="h-4 w-4" /></button>
      <button onClick={() => onDuplicate(template)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-900" title="Duplicate"><Copy className="h-4 w-4" /></button>
      <button onClick={() => onDelete(template)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

export default function SmsTemplatesPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<SmsTemplate | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SmsTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async (): Promise<SmsTemplate[]> => (await api.get("/message-templates")).data.data,
  });

  const templates = (data ?? []).filter((t) => t.channel_kind === "sms");
  const info = smsInfo(body);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string | number; name: string; body: string }): Promise<void> => {
      if (payload.id) {
        await api.put(`/message-templates/${payload.id}`, { name: payload.name, body: payload.body });
      } else {
        await api.post("/message-templates", { name: payload.name, channel_kind: "sms", body: payload.body });
      }
    },
    onSuccess: (_response, variables) => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      setFormOpen(false);
      toast.success(variables.id ? "SMS template updated" : "SMS template created");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to save template")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (template: SmsTemplate) =>
      api.post("/message-templates", {
        name: `${template.name} (copy)`,
        channel_kind: "sms",
        body: template.body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success("SMS template duplicated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to duplicate template")),
  });

  const deleteMutation = useMutation({
    mutationFn: (template: SmsTemplate) => api.delete(`/message-templates/${template.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      setDeleteTarget(null);
      toast.success("SMS template deleted");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to delete template")),
  });

  const previewMutation = useMutation({
    mutationFn: (template: SmsTemplate) =>
      api.post(`/message-templates/${template.id}/preview`, SAMPLE_VARIABLES),
    onSuccess: (response) => {
      const result = response.data?.data;
      setPreviewBody(result?.body ?? result?.rendered ?? JSON.stringify(result));
    },
    onError: (error) => toast.error(errorMessage(error, "Preview failed")),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setBody("");
    setFormOpen(true);
  };

  const openEdit = (template: SmsTemplate) => {
    setEditing(template);
    setName(template.name);
    setBody(template.body ?? "");
    setFormOpen(true);
  };

  const openPreview = (template: SmsTemplate) => {
    setPreviewBody(null);
    setPreviewTemplate(template);
    previewMutation.mutate(template);
  };

  const insertVariable = (variable: string) => {
    const el = document.getElementById(BODY_ID) as HTMLTextAreaElement | null;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${variable}${body.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate({ id: editing?.id, name: name.trim(), body });
  };

  const actions = (template: SmsTemplate) => (
    <TemplateActions
      template={template}
      onEdit={openEdit}
      onPreview={openPreview}
      onDuplicate={(t) => duplicateMutation.mutate(t)}
      onDelete={setDeleteTarget}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Templates</h1>
          <p className="text-sm text-slate-500">
            SMS templates used for invitations and check-in cards. Name a template{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">invitation</code> or{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">checkin_card</code> to
            customise those messages.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="flex-shrink-0">
          <Plus className="h-3.5 w-3.5" /> New SMS Template
        </Button>
      </div>

      <Card className="border-gold-200 bg-gold-50/40">
        <div className="flex gap-3">
          <MessageSquare className="h-5 w-5 flex-shrink-0 text-gold-600" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Special template names</p>
            <p className="mt-1">
              The backend uses SMS templates named exactly{" "}
              <code className="font-semibold">invitation</code> and{" "}
              <code className="font-semibold">checkin_card</code> when present. If either is
              missing, the built-in message is used instead.
            </p>
          </div>
        </div>
      </Card>

      <Card title="SMS Templates">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <MessageSquare className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No SMS templates yet</p>
            <p className="max-w-md text-sm text-slate-500">
              Create a template named <code>invitation</code> or <code>checkin_card</code> to
              override the built-in invitation and check-in card messages. You can also add
              templates for any other SMS message.
            </p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> New SMS Template
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Name", "Body", "Segments", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((template) => {
                    const segments = smsInfo(template.body ?? "");
                    return (
                      <tr key={template.id} className="align-top transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words">{template.name}</span>
                            {SPECIAL_NAMES.includes(template.name) && (
                              <Badge label="Built-in override" variant="gold" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-md whitespace-pre-wrap break-words font-mono text-xs text-slate-600">
                            {template.body || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={segments.segments > 1 ? "font-semibold text-amber-600" : "text-slate-700"}>
                            {segments.segments} segment(s)
                          </span>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {segments.unicode ? "Unicode" : "GSM-7"} · {segments.length} chars
                          </p>
                        </td>
                        <td className="px-4 py-3">{actions(template)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {templates.map((template) => {
                const segments = smsInfo(template.body ?? "");
                return (
                  <div key={template.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-semibold text-slate-900">{template.name}</span>
                      {SPECIAL_NAMES.includes(template.name) && (
                        <Badge label="Built-in override" variant="gold" />
                      )}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-600">
                      {template.body || "—"}
                    </div>
                    <p className={`mt-2 text-xs ${segments.segments > 1 ? "font-semibold text-amber-600" : "text-slate-500"}`}>
                      {segments.segments} segment(s) · {segments.unicode ? "Unicode" : "GSM-7"} · {segments.length} chars
                    </p>
                    <div className="mt-3 border-t border-slate-100 pt-2">{actions(template)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Create / edit modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit SMS Template" : "New SMS Template"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Template name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="invitation"
            required
            hint='Use "invitation" or "checkin_card" to override the built-in messages.'
          />
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Insert a variable at the cursor</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 font-mono text-[11px] text-gold-700 transition hover:bg-gold-100"
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Textarea
              id={BODY_ID}
              label="Message body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              required
              className="font-mono"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                {info.length} character(s) · {info.unicode ? "Unicode" : "GSM-7"} (
                {info.unicode ? "70 / 67" : "160 / 153"} per segment)
              </span>
              <span className={info.segments > 1 ? "font-semibold text-amber-600" : "text-slate-500"}>
                {info.segments} segment(s)
              </span>
            </div>
            {info.segments > 1 && (
              <p className="mt-1 text-xs text-amber-600">
                This message will be sent as multiple SMS segments and may cost more.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editing ? "Save changes" : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Preview modal */}
      <Modal
        isOpen={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        title={`Preview: ${previewTemplate?.name ?? ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Rendered with sample guest and event details.</p>
          <div className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 font-mono text-sm text-slate-700">
            {previewMutation.isPending
              ? "Rendering…"
              : (previewBody ?? previewTemplate?.body ?? "—")}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete SMS template"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete <strong className="break-words">{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
