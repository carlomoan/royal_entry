"use client";

// Preview and send the WhatsApp check-in card message for one guest.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, ExternalLink, FileText, MessageCircle, Users } from "lucide-react";
import api from "@/lib/api";
import { Badge, Button, Card, Select, Textarea } from "@/components/ui";

type EventInfo = {
  id?: string;
  title?: string;
};

type Guest = {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  table_number?: string | number | null;
  guest_category?: string | null;
  device_type?: string | null;
  card_issued_at?: string | null;
};

type Invitation = {
  guest_id: string;
  short_link: string;
};

type MessageTemplate = {
  id: string;
  name: string;
  channel_kind: string;
  subject?: string | null;
  body: string;
};

type SendResult = {
  delivered: boolean;
  message: string;
};

const DEFAULT_BODY =
  "Habari {{guest_name}}!\n\nKadi yako ya kuingia kwenye {{event_title}} iko tayari.\n\nKodi ya kuingia: {{entry_code}}\nKadi: {{check_in_link}}\nPDF: {{pdf_url}}\n\nUsitume ujumbe huu kwa mtu mwingine.";

const VARIABLES = [
  "guest_name",
  "entry_code",
  "check_in_link",
  "qr_url",
  "pdf_url",
  "event_title",
] as const;

const EDITOR_ID = "whatsapp-template-body";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function apiError(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as {
      response?: { data?: { error?: { message?: string }; message?: string } };
      message?: string;
    };
    return (
      err.response?.data?.error?.message ??
      err.response?.data?.message ??
      err.message ??
      "Something went wrong"
    );
  }
  return "Something went wrong";
}

function display(value: string | number | null | undefined, fallback = "—"): string {
  return value == null || value === "" ? fallback : String(value);
}

export default function WhatsAppPreviewPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const queryClient = useQueryClient();

  const [body, setBody] = useState(DEFAULT_BODY);
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [origin, setOrigin] = useState("");
  const editedRef = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { data: event, isLoading: eventLoading } = useQuery<EventInfo>({
    queryKey: ["whatsapp-preview", "event", id],
    queryFn: async () => (await api.get(`/events/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: guests = [], isLoading: guestsLoading } = useQuery<Guest[]>({
    queryKey: ["whatsapp-preview", "guests", id],
    queryFn: async () =>
      asArray<Guest>((await api.get(`/events/${id}/guests?per_page=500`)).data.data),
    enabled: !!id,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["whatsapp-preview", "invitations", id],
    queryFn: async () =>
      asArray<Invitation>((await api.get(`/events/${id}/invitations`)).data.data),
    enabled: !!id,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["message-templates"],
    queryFn: async () => asArray<MessageTemplate>((await api.get("/message-templates")).data.data),
  });

  const savedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          template.channel_kind === "whatsapp" && template.name === "checkin_card"
      ),
    [templates]
  );

  useEffect(() => {
    if (savedTemplate && !editedRef.current) {
      setBody(savedTemplate.body || DEFAULT_BODY);
    }
  }, [savedTemplate]);

  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? guests[0] ?? null;

  useEffect(() => {
    setSendResult(null);
  }, [selectedGuest?.id]);

  const shortLink =
    invitations.find((invitation) => invitation.guest_id === selectedGuest?.id)?.short_link ?? "";
  const checkInLink = shortLink ? `${origin}/g/${shortLink}` : "";
  const pdfUrl = shortLink
    ? `${origin}/api/v1/public/invitations/${shortLink}/card/pdf`
    : "";
  const qrUrl = shortLink ? `${origin}/api/v1/public/invitations/${shortLink}/qr` : "";

  const variables: Record<string, string> = {
    guest_name: selectedGuest?.full_name ?? "Guest",
    event_title: event?.title ?? "your event",
    check_in_link: checkInLink || "[check-in link]",
    entry_code: "LAFE-QORI-2180",
    qr_url: qrUrl || "[QR code]",
    pdf_url: pdfUrl || "[PDF card]",
    table_number: display(selectedGuest?.table_number),
  };

  const renderedMessage = body.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, key: string) => variables[key] ?? match
  );

  const insertVariable = (token: string) => {
    const editor =
      typeof document !== "undefined"
        ? (document.getElementById(EDITOR_ID) as HTMLTextAreaElement | null)
        : null;
    const start = editor?.selectionStart ?? body.length;
    const end = editor?.selectionEnd ?? start;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    editedRef.current = true;
    const caret = start + token.length;
    window.setTimeout(() => {
      editor?.focus();
      editor?.setSelectionRange(caret, caret);
    }, 0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (savedTemplate?.id) {
        await api.put(`/message-templates/${savedTemplate.id}`, { body });
      } else {
        await api.post("/message-templates", {
          name: "checkin_card",
          channel_kind: "whatsapp",
          body,
        });
      }
    },
    onSuccess: () => {
      editedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success(savedTemplate ? "WhatsApp template updated" : "WhatsApp template created");
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const sendMutation = useMutation({
    mutationFn: async (guestId: string) =>
      (await api.post(`/events/${id}/guests/${guestId}/send-checkin`)).data.data as SendResult,
    onSuccess: (result) => {
      setSendResult(result);
      toast.success(result?.message || "Check-in details sent");
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const loading = eventLoading || guestsLoading || invitationsLoading || templatesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-navy-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/events/${id}`)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
            aria-label="Back to event"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">WhatsApp check-in preview</h1>
            <p className="mt-1 break-words text-sm text-slate-400">
              {event?.title
                ? `${event.title} · edit the message, preview it for a guest, then send.`
                : "Edit the message, preview it for a guest, then send."}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column: editor */}
          <Card
            title="Message template"
            action={
              savedTemplate ? (
                <Badge label="Saved template" variant="green" />
              ) : (
                <Badge label="Default · not saved" variant="gold" />
              )
            }
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600">
                  Variables — click to insert at the cursor
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {VARIABLES.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => insertVariable(`{{${variable}}}`)}
                      className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-gold-800 transition hover:bg-gold-100"
                    >
                      {`{{${variable}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                id={EDITOR_ID}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  editedRef.current = true;
                }}
                rows={14}
                spellCheck={false}
                className="min-h-[280px] resize-y break-words font-mono text-xs leading-relaxed sm:text-sm"
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  isLoading={saveMutation.isPending}
                >
                  {savedTemplate ? "Save changes" : "Save template"}
                </Button>
                <span className="break-words text-xs text-slate-400">
                  Saved as the <span className="font-mono">checkin_card</span> WhatsApp template.
                </span>
              </div>
            </div>
          </Card>

          {/* Right column: preview */}
          <Card title="Preview">
            {guests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-slate-300" />
                <p className="break-words text-sm font-medium text-slate-600">
                  No guests to preview yet
                </p>
                <p className="max-w-sm break-words text-xs text-slate-400">
                  Add guests to this event, then come back to preview and send their check-in card.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <Select
                  label="Guest"
                  value={selectedGuest?.id ?? ""}
                  onChange={(event) => setSelectedGuestId(event.target.value)}
                  className="w-full"
                >
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.full_name}
                      {guest.phone ? ` · ${guest.phone}` : ""}
                    </option>
                  ))}
                </Select>

                {/* Guest details */}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                    <InfoRow label="Name" value={display(selectedGuest?.full_name)} />
                    <InfoRow label="Phone" value={display(selectedGuest?.phone)} />
                    <InfoRow label="Class" value={display(selectedGuest?.guest_category)} />
                    <InfoRow label="Table" value={display(selectedGuest?.table_number)} />
                    <InfoRow label="Device" value={display(selectedGuest?.device_type)} />
                    <InfoRow label="Card issued" value={display(selectedGuest?.card_issued_at)} />
                  </div>
                </div>

                {/* Rendered message */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rendered message
                  </p>
                  <div className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-[#e5ddd5] p-4 text-sm leading-relaxed text-slate-800">
                    {renderedMessage}
                  </div>
                </div>

                {/* PDF card */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Check-in card PDF
                    </p>
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open PDF in new tab
                      </a>
                    )}
                  </div>
                  {pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      title={`Check-in card PDF for ${selectedGuest?.full_name ?? "guest"}`}
                      className="h-[600px] w-full rounded-lg border border-slate-200 bg-white"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="break-words text-sm text-slate-500">
                        {invitations.length === 0
                          ? "No invitations have been generated for this event yet."
                          : "This guest does not have an invitation yet."}
                      </p>
                      <p className="mt-1 break-words text-xs text-slate-400">
                        The PDF preview will appear once an invitation exists.
                      </p>
                    </div>
                  )}
                </div>

                {/* Send */}
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <Button
                    onClick={() => selectedGuest && sendMutation.mutate(selectedGuest.id)}
                    disabled={!selectedGuest || sendMutation.isPending}
                    isLoading={sendMutation.isPending}
                  >
                    <MessageCircle className="h-4 w-4" /> Send via WhatsApp
                  </Button>
                  <span className="max-w-xs break-words text-xs text-slate-400">
                    Delivery uses the saved template on the server — save your edits first.
                  </span>
                </div>

                {sendResult && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
                    <Badge
                      label={sendResult.delivered ? "Delivered" : "Not delivered"}
                      variant={sendResult.delivered ? "green" : "rose"}
                    />
                    <span className="break-words text-xs text-slate-600">
                      {sendResult.message}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <span className="w-20 shrink-0 font-semibold text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-slate-700">{value}</span>
    </div>
  );
}
