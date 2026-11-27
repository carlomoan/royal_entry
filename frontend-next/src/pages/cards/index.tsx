"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Save, QrCode, Trash2, Eye, Edit3, CheckCircle2,
  AlertCircle, Loader2, Image as ImageIcon, ArrowRight, ArrowLeft,
  Download, Copy, Check, RotateCcw
} from "lucide-react";
import { Rnd } from "react-rnd";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge, Modal } from "@/components/ui";
import { RoyalCard } from "@/components/cards/RoyalCard";
import { CardTemplateRecord, QrPosition } from "@/types/cardTheme";

type SetupStep = "upload" | "position" | "review";

type TemplatePreviewSource = {
  theme_config?: { front_image_url?: unknown; front_file_id?: string } | null;
  background_file_id?: string | null;
};

type CardFieldKey = "guest_name" | "ticket_no" | "table_number" | "category";
type FieldPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  align: "left" | "center";
};
type FieldPositions = Record<CardFieldKey, FieldPosition>;

const CARD_FIELD_KEYS: CardFieldKey[] = ["guest_name", "ticket_no", "table_number", "category"];

const DEFAULT_QR_COLOR = "#000000";
const TEXT_COLOR_PRESETS = [
  { label: "Navy", value: "#0f172a" },
  { label: "Maroon", value: "#7a1220" },
  { label: "Gold", value: "#b8860b" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
] as const;

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const CARD_FIELD_META: Record<CardFieldKey, { label: string; sample: string }> = {
  guest_name: { label: "Jina kamili", sample: "Jina kamili: Asha Mwangi" },
  ticket_no: { label: "Namba ya tiketi", sample: "Tiketi: RE-2026-0142" },
  table_number: { label: "Namba ya meza", sample: "Meza: 12" },
  category: { label: "Kikundi", sample: "VIP" },
};

/** Caritas check-in pass layout; every call returns fresh objects. */
function caritasFieldLayout(): FieldPositions {
  return {
    guest_name: { x: 10, y: 37, w: 80, h: 9, color: "#2563eb", align: "center" },
    ticket_no: { x: 10, y: 49, w: 80, h: 9, color: "#7c3aed", align: "center" },
    table_number: { x: 10, y: 60, w: 53, h: 8, color: "#059669", align: "center" },
    category: { x: 10, y: 69, w: 53, h: 10, color: "#e11d48", align: "center" },
  };
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** Read stored field_positions defensively; missing/invalid values fall back to Caritas. */
function normalizeFieldPositions(stored: unknown): FieldPositions {
  const result = caritasFieldLayout();
  if (!stored || typeof stored !== "object") return result;
  const raw = stored as Record<string, Partial<FieldPosition> | undefined>;
  const pct = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? clampPercent(value) : fallback;

  CARD_FIELD_KEYS.forEach((key) => {
    const value = raw[key];
    if (!value || typeof value !== "object") return;
    const fallback = result[key];
    result[key] = {
      x: pct(value.x, fallback.x),
      y: pct(value.y, fallback.y),
      w: pct(value.w, fallback.w),
      h: pct(value.h, fallback.h),
      color: isHexColor(value.color) ? value.color : fallback.color,
      align: value.align === "left" || value.align === "center" ? value.align : fallback.align,
    };
  });
  return result;
}

type PreviewEvent = { id: string; title?: string };
type PreviewGuest = {
  id: string;
  full_name?: string;
  phone?: string;
  table_number?: string | number | null;
  guest_category?: string | null;
  short_link?: string | null;
};
type PreviewInvitation = { guest_id?: string; short_link?: string | null };

/** Stored file ids are authoritative; front_image_url is often stale. */
function templateImageUrl(t: TemplatePreviewSource | null | undefined): string | null {
  const url = t?.theme_config?.front_image_url;
  if (typeof url === "string" && (url.startsWith("/api/v1/files/") || url.startsWith("http"))) {
    return url;
  }
  const fileId = t?.theme_config?.front_file_id || t?.background_file_id;
  return fileId ? `/api/v1/files/${fileId}` : null;
}

export default function CardSetupPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<SetupStep>("upload");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [frontFileId, setFrontFileId] = useState("");
  const [qrPos, setQrPos] = useState<QrPosition>({ x: 65, y: 75, w: 20, h: 20 });
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewEventId, setPreviewEventId] = useState("");
  const [previewGuestId, setPreviewGuestId] = useState("");
  const [fieldPositions, setFieldPositions] = useState<FieldPositions>(() => caritasFieldLayout());
  const [qrColor, setQrColor] = useState<string>(DEFAULT_QR_COLOR);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const designImageRef = useRef<HTMLImageElement>(null);

  // The Rnd boxes are positioned in pixels, so keep them in sync with the
  // displayed image size (it scales with the viewport).
  useEffect(() => {
    if (step !== "position" || !frontImage) return;
    const image = designImageRef.current;
    if (!image) return;
    const measure = () => {
      const rect = image.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    return () => observer.disconnect();
  }, [step, frontImage]);

  const updateField = (key: CardFieldKey, patch: Partial<FieldPosition>) => {
    setFieldPositions((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const applyColorToAllFields = (color: string) => {
    setFieldPositions((prev) => {
      const next = { ...prev };
      CARD_FIELD_KEYS.forEach((key) => {
        next[key] = { ...next[key], color };
      });
      return next;
    });
  };

  const resetFieldPositions = () => {
    setFieldPositions(caritasFieldLayout());
    toast.success("Field positions reset to the Caritas layout");
  };

  // Fetch existing templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: async () => {
      const res = await api.get("/cards/templates");
      return res.data.data ?? [];
    },
  });

  // Real-data preview: events and guests used to stamp the card.
  const { data: previewEvents = [], isLoading: previewEventsLoading } = useQuery({
    queryKey: ["card-preview-events"],
    queryFn: async () => {
      const res = await api.get("/events", { params: { per_page: 100 } });
      return (res.data?.data ?? []) as PreviewEvent[];
    },
    enabled: !!previewTemplate,
  });

  const { data: previewGuests = [], isLoading: previewGuestsLoading } = useQuery({
    queryKey: ["card-preview-guests", previewEventId],
    queryFn: async () => {
      const res = await api.get(`/events/${previewEventId}/guests`, {
        params: { per_page: 200 },
      });
      return (res.data?.data ?? []) as PreviewGuest[];
    },
    enabled: !!previewTemplate && !!previewEventId,
  });

  const previewGuest = previewGuests.find((g) => g.id === previewGuestId) ?? null;

  // Guests don't always carry short_link; look it up from the event invitations.
  const { data: previewInvitations = [] } = useQuery({
    queryKey: ["card-preview-invitations", previewEventId],
    queryFn: async () => {
      const res = await api.get(`/events/${previewEventId}/invitations`);
      return (res.data?.data ?? []) as PreviewInvitation[];
    },
    enabled: !!previewTemplate && !!previewEventId && !!previewGuest && !previewGuest.short_link,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/files/upload", form);
    },
    onSuccess: (res) => {
      const fileId = res.data.data?.file_id || res.data.data?.id;
      const fileUrl = res.data.data?.url || res.data.data?.path || fileId;
      setFrontFileId(fileId);
      setFrontImage(fileUrl);
      toast.success("Design uploaded successfully!");
      setStep("position");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? "Upload failed");
    },
  });

  // Save template mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post("/cards/templates", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card-templates"] });
      toast.success("Template saved successfully!");
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || "Failed to save template");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/cards/templates/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card-templates"] });
      toast.success("Template updated successfully!");
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || "Failed to update template");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cards/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card-templates"] });
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const resetForm = () => {
    setStep("upload");
    setFrontImage(null);
    setFrontFileId("");
    setTemplateName("");
    setTemplateDescription("");
    setQrPos({ x: 65, y: 75, w: 20, h: 20 });
    setFieldPositions(caritasFieldLayout());
    setQrColor(DEFAULT_QR_COLOR);
    setEditingId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  const handleSave = () => {
    if (!frontFileId) {
      toast.error("Please upload a design first");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    setStep("review");
  };

  const confirmSave = () => {
    const payload = {
      name: templateName,
      description: templateDescription,
      theme_config: {
        front_file_id: frontFileId,
        front_image_url: frontImage,
        qr_position: qrPos,
        qr_color: qrColor,
        field_positions: fieldPositions,
      },
      is_active: true,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      saveMutation.mutate(payload);
    }
  };

  const handleEdit = (t: any) => {
    const storedQr = t?.theme_config?.qr_position;
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    setTemplateName(t?.name || "");
    setTemplateDescription(t?.description || "");
    setFrontFileId(t?.theme_config?.front_file_id || t?.background_file_id || "");
    setFrontImage(templateImageUrl(t));
    setQrPos({
      x: num(storedQr?.x, 65),
      y: num(storedQr?.y, 75),
      w: num(storedQr?.w, 20),
      h: num(storedQr?.h, 20),
    });
    setFieldPositions(normalizeFieldPositions(t?.theme_config?.field_positions));
    setQrColor(isHexColor(t?.theme_config?.qr_color) ? t.theme_config.qr_color : DEFAULT_QR_COLOR);
    setEditingId(t?.id || null);
    setStep("position");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previewImageUrl = templateImageUrl(previewTemplate);
  const previewQr = previewTemplate?.theme_config?.qr_position;
  const showPreviewQr = previewQr &&
    [previewQr.x, previewQr.y, previewQr.w, previewQr.h]
      .every((v: unknown) => typeof v === "number" && Number.isFinite(v));

  const previewShortLink =
    previewGuest?.short_link ||
    previewInvitations.find((inv) => inv.guest_id === previewGuest?.id)?.short_link ||
    previewGuest?.id ||
    "";
  const previewQrPayload = previewGuest && typeof window !== "undefined"
    ? `${window.location.origin}/g/${previewShortLink}`
    : "";

  const copyTemplateId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Template ID copied");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Card Template Studio</h1>
          <p className="text-slate-600">
            Upload your manually designed card and position the QR code for automatic guest personalization
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {(["upload", "position", "review"] as SetupStep[]).map((s, idx) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${step === s ? "bg-gold-500 text-white scale-110" :
                  idx < (["upload", "position", "review"].indexOf(step)) ? "bg-green-500 text-white" :
                    "bg-slate-200 text-slate-500"
                  }`}>
                  {idx < (["upload", "position", "review"].indexOf(step)) ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${step === s ? "text-slate-900" : "text-slate-500"
                  }`}>
                  {s === "upload" ? "Upload Design" : s === "position" ? "Position QR" : "Review & Save"}
                </span>
                {idx < 2 && <div className="w-6 sm:w-16 h-0.5 bg-slate-200 mx-2 sm:mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <Card className="p-5 sm:p-8 mb-8">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Wedding Invitation - Gold Theme"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of this template..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:outline-none"
                />
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center bg-slate-50 hover:border-gold-400 hover:bg-gold-50/30 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-gold-500 animate-spin mb-3" />
                    <p className="text-sm font-medium text-slate-700">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gold-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="h-8 w-8 text-gold-600" />
                    </div>
                    <p className="text-base font-semibold text-slate-900 mb-1">
                      Click to upload your card design
                    </p>
                    <p className="text-sm text-slate-500">
                      PNG or JPG, max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Position QR */}
          {step === "position" && frontImage && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Position QR Code</h3>
                  <p className="text-sm text-slate-500">
                    Drag and resize the yellow QR box and the coloured field boxes to mark where each value should appear
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Change Image
                </Button>
              </div>

              <div className="w-full overflow-x-auto">
              <div className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-100 mx-auto max-w-2xl min-w-[600px] sm:min-w-0">
                <img
                  ref={designImageRef}
                  src={frontImage}
                  alt="Card Design"
                  className="w-full h-auto block"
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    console.log("Image loaded:", img.naturalWidth, "x", img.naturalHeight);
                  }}
                />

                {(() => {
                  const qrHandleStyle: React.CSSProperties = {
                    backgroundColor: "#ffffff",
                    border: "1px solid #d97706",
                    borderRadius: 3,
                  };
                  return (
                <Rnd
                  size={{
                    width: (qrPos.w / 100) * canvasSize.width,
                    height: (qrPos.h / 100) * canvasSize.height,
                  }}
                  position={{
                    x: (qrPos.x / 100) * canvasSize.width,
                    y: (qrPos.y / 100) * canvasSize.height,
                  }}
                  bounds="parent"
                  enableResizing={{
                    topLeft: true,
                    topRight: true,
                    bottomLeft: true,
                    bottomRight: true,
                    top: false,
                    right: false,
                    bottom: false,
                    left: false,
                  }}
                  resizeHandleStyles={{
                    topLeft: qrHandleStyle,
                    topRight: qrHandleStyle,
                    bottomLeft: qrHandleStyle,
                    bottomRight: qrHandleStyle,
                  }}
                  onDragStop={(_, d) => {
                    const imageRect = designImageRef.current?.getBoundingClientRect();
                    const boxRect = d.node.getBoundingClientRect();
                    if (!imageRect || !imageRect.width || !imageRect.height) return;
                    setQrPos((p) => ({
                      ...p,
                      x: clampPercent(((boxRect.left - imageRect.left) / imageRect.width) * 100),
                      y: clampPercent(((boxRect.top - imageRect.top) / imageRect.height) * 100),
                    }));
                  }}
                  onResizeStop={(_, __, ref) => {
                    const imageRect = designImageRef.current?.getBoundingClientRect();
                    const boxRect = ref.getBoundingClientRect();
                    if (!imageRect || !imageRect.width || !imageRect.height) return;
                    setQrPos((p) => ({
                      ...p,
                      x: clampPercent(((boxRect.left - imageRect.left) / imageRect.width) * 100),
                      y: clampPercent(((boxRect.top - imageRect.top) / imageRect.height) * 100),
                      w: clampPercent((boxRect.width / imageRect.width) * 100),
                      h: clampPercent((boxRect.height / imageRect.height) * 100),
                    }));
                  }}
                  className="border-2 border-dashed border-gold-500 bg-gold-500/20 flex items-center justify-center cursor-move z-10"
                  style={{ minWidth: 24, minHeight: 24 }}
                >
                  <div className="bg-white/90 rounded-full p-2 shadow-lg pointer-events-none">
                    <QrCode className="h-5 w-5 text-gold-700" />
                  </div>
                </Rnd>
                  );
                })()}

                {CARD_FIELD_KEYS.map((key) => {
                  const pos = fieldPositions[key];
                  const meta = CARD_FIELD_META[key];
                  const handleStyle: React.CSSProperties = {
                    backgroundColor: "#ffffff",
                    border: `1px solid ${pos.color}`,
                    borderRadius: 3,
                  };
                  return (
                    <Rnd
                      key={key}
                      size={{
                        width: (pos.w / 100) * canvasSize.width,
                        height: (pos.h / 100) * canvasSize.height,
                      }}
                      position={{
                        x: (pos.x / 100) * canvasSize.width,
                        y: (pos.y / 100) * canvasSize.height,
                      }}
                      bounds="parent"
                      enableResizing={{
                        topLeft: true,
                        topRight: true,
                        bottomLeft: true,
                        bottomRight: true,
                        top: false,
                        right: false,
                        bottom: false,
                        left: false,
                      }}
                      resizeHandleStyles={{
                        topLeft: handleStyle,
                        topRight: handleStyle,
                        bottomLeft: handleStyle,
                        bottomRight: handleStyle,
                      }}
                      onDragStop={(_, d) => {
                        const imageRect = designImageRef.current?.getBoundingClientRect();
                        const boxRect = d.node.getBoundingClientRect();
                        if (!imageRect || !imageRect.width || !imageRect.height) return;
                        setFieldPositions((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            x: clampPercent(((boxRect.left - imageRect.left) / imageRect.width) * 100),
                            y: clampPercent(((boxRect.top - imageRect.top) / imageRect.height) * 100),
                          },
                        }));
                      }}
                      onResizeStop={(_, __, ref) => {
                        const imageRect = designImageRef.current?.getBoundingClientRect();
                        const boxRect = ref.getBoundingClientRect();
                        if (!imageRect || !imageRect.width || !imageRect.height) return;
                        setFieldPositions((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            x: clampPercent(((boxRect.left - imageRect.left) / imageRect.width) * 100),
                            y: clampPercent(((boxRect.top - imageRect.top) / imageRect.height) * 100),
                            w: clampPercent((boxRect.width / imageRect.width) * 100),
                            h: clampPercent((boxRect.height / imageRect.height) * 100),
                          },
                        }));
                      }}
                      className="border-2 border-dashed cursor-move z-10 flex"
                      style={{
                        borderColor: pos.color,
                        backgroundColor: `${pos.color}22`,
                        color: pos.color,
                        minWidth: 24,
                        minHeight: 18,
                      }}
                    >
                      <div
                        className={`w-full h-full flex flex-col justify-center px-1 pointer-events-none overflow-hidden ${
                          pos.align === "center" ? "items-center text-center" : "items-start text-left"
                        }`}
                      >
                        <span className="text-[9px] font-bold uppercase leading-tight drop-shadow-sm">
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold leading-tight w-full truncate drop-shadow-sm">
                          {meta.sample}
                        </span>
                      </div>
                    </Rnd>
                  );
                })}
              </div>
              </div>

              {/* QR Position Info */}
              <div className="bg-slate-50 rounded-lg p-4 max-w-2xl mx-auto">
                <p className="text-xs font-semibold text-slate-600 mb-2">QR Code Position:</p>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">X:</span>
                    <span className="ml-1 font-mono font-semibold">{qrPos.x.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Y:</span>
                    <span className="ml-1 font-mono font-semibold">{qrPos.y.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">W:</span>
                    <span className="ml-1 font-mono font-semibold">{qrPos.w.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">H:</span>
                    <span className="ml-1 font-mono font-semibold">{qrPos.h.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Text colour + QR colour tools */}
              <div className="max-w-2xl mx-auto rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Text colour</h4>
                  <p className="text-[11px] text-slate-500">
                    Colours are stamped onto the card when a guest card is rendered.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">All fields text colour</p>
                      <label className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="All fields text colour"
                          value={fieldPositions.guest_name.color}
                          onChange={(e) => applyColorToAllFields(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                        />
                        <span className="font-mono text-xs text-slate-600">
                          {fieldPositions.guest_name.color}
                        </span>
                      </label>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Applies to all four fields; fine-tune individual fields below.
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600">Quick presets</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TEXT_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            title={`${preset.label} (${preset.value})`}
                            aria-label={`Apply ${preset.label} text colour to all fields`}
                            onClick={() => applyColorToAllFields(preset.value)}
                            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                              fieldPositions.guest_name.color.toLowerCase() === preset.value
                                ? "border-gold-500 ring-2 ring-gold-300"
                                : "border-slate-300"
                            }`}
                            style={{ backgroundColor: preset.value }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">QR colour</p>
                    <label className="mt-2 flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="QR colour"
                        value={qrColor}
                        onChange={(e) => setQrColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      />
                      <span className="font-mono text-xs text-slate-600">{qrColor}</span>
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Colour used for the QR code on rendered guest cards.
                    </p>
                  </div>
                </div>
              </div>

              {/* Field positions */}
              <div className="bg-slate-50 rounded-lg p-4 max-w-2xl mx-auto space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Field positions</p>
                    <p className="text-[11px] text-slate-500">
                      Choose the text colour and alignment stamped onto the card.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetFieldPositions}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset fields to Caritas layout
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CARD_FIELD_KEYS.map((key) => {
                    const pos = fieldPositions[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: pos.color }}
                        />
                        <span className="flex-1 min-w-[90px] text-xs font-medium text-slate-700">
                          {CARD_FIELD_META[key].label}
                        </span>
                        <label className="flex items-center gap-1 text-[11px] text-slate-500">
                          Colour
                          <input
                            type="color"
                            aria-label={`${CARD_FIELD_META[key].label} colour`}
                            value={pos.color}
                            onChange={(e) => updateField(key, { color: e.target.value })}
                            className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-slate-500">
                          Align
                          <select
                            aria-label={`${CARD_FIELD_META[key].label} alignment`}
                            value={pos.align}
                            onChange={(e) =>
                              updateField(key, { align: e.target.value as "left" | "center" })
                            }
                            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-gold-500 focus:outline-none"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                          </select>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between max-w-2xl mx-auto">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={handleSave}>
                  Continue to Review <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && frontImage && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to Save</h3>
                <p className="text-slate-600">Review your template configuration before saving</p>
              </div>

              <div className="max-w-2xl mx-auto bg-slate-50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Template Name</p>
                  <p className="text-base font-semibold text-slate-900">{templateName}</p>
                </div>
                {templateDescription && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                    <p className="text-sm text-slate-700">{templateDescription}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Design Preview</p>
                  <img src={frontImage} alt="Preview" className="mt-2 rounded-lg border border-slate-200 max-h-64 w-auto" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">QR Position</p>
                  <div className="mt-2 grid grid-cols-4 gap-3 text-sm">
                    <div><span className="text-slate-500">X:</span> <span className="font-mono font-semibold">{qrPos.x.toFixed(1)}%</span></div>
                    <div><span className="text-slate-500">Y:</span> <span className="font-mono font-semibold">{qrPos.y.toFixed(1)}%</span></div>
                    <div><span className="text-slate-500">W:</span> <span className="font-mono font-semibold">{qrPos.w.toFixed(1)}%</span></div>
                    <div><span className="text-slate-500">H:</span> <span className="font-mono font-semibold">{qrPos.h.toFixed(1)}%</span></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => setStep("position")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Adjust Position
                </Button>
                {editingId && (
                  <Button variant="ghost" onClick={resetForm}>Cancel Edit</Button>
                )}
                <Button
                  onClick={confirmSave}
                  isLoading={saveMutation.isPending || updateMutation.isPending}
                  size="lg"
                >
                  <Save className="h-4 w-4 mr-2" /> {editingId ? "Update Template" : "Save Template"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Saved Templates Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Saved Templates</h2>
            <Badge label={`${templates.length} templates`} variant="slate" />
          </div>

          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse bg-slate-200 rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-200 bg-white">
              <ImageIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No templates yet</h3>
              <p className="text-sm text-slate-500 mb-4">Create your first card template to get started</p>
              <Button onClick={() => setStep("upload")}>
                <Upload className="h-4 w-4 mr-2" /> Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t: any) => {
                const imageUrl = templateImageUrl(t);
                return (
                <div key={t.id} className="overflow-hidden group hover:shadow-lg transition-shadow rounded-xl border border-slate-200 bg-white">
                  <div className="relative h-48 bg-slate-100">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={t.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge
                        label={t.is_active ? "Active" : "Draft"}
                        variant={t.is_active ? "green" : "slate"}
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-1 truncate">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <span>ID: {t.id.slice(0, 8)}...</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewTemplate(t)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(t)}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyTemplateId(t.id)}
                        title="Copy ID"
                      >
                        {copiedId === t.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`)) {
                            deleteMutation.mutate(t.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title="Template Preview"
        size="lg"
      >
        {previewTemplate && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-preview-event" className="block text-xs font-semibold text-slate-600 mb-1">
                  Event
                </label>
                <select
                  id="card-preview-event"
                  value={previewEventId}
                  onChange={(e) => {
                    setPreviewEventId(e.target.value);
                    setPreviewGuestId("");
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:outline-none"
                >
                  <option value="">{previewEventsLoading ? "Loading events…" : "Select an event"}</option>
                  {previewEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.title || "Untitled event"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="card-preview-guest" className="block text-xs font-semibold text-slate-600 mb-1">
                  Guest
                </label>
                <select
                  id="card-preview-guest"
                  value={previewGuestId}
                  onChange={(e) => setPreviewGuestId(e.target.value)}
                  disabled={!previewEventId}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!previewEventId ? "Select an event first" : previewGuestsLoading ? "Loading guests…" : "Select a guest"}
                  </option>
                  {previewGuests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.full_name || guest.phone || "Unnamed guest"}
                      {guest.table_number ? ` · Table ${guest.table_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Preview uses real guest data — name and QR are stamped exactly as on the guest&apos;s card.
            </p>
            {previewGuest ? (
              <div className="w-full overflow-x-auto">
                <RoyalCard
                  template={previewTemplate as CardTemplateRecord}
                  qrPayload={previewQrPayload}
                  guestName={previewGuest.full_name}
                  qrPosition={previewQr as QrPosition | undefined}
                  width={520}
                />
              </div>
            ) : (
              previewImageUrl && (
                <div className="relative w-full">
                  <img
                    src={previewImageUrl}
                    alt={previewTemplate.name}
                    className="w-full rounded-lg border border-slate-200 block"
                  />
                  {showPreviewQr && (
                    <div
                      className="absolute border-2 border-dashed border-gold-500 bg-gold-500/20 flex items-center justify-center pointer-events-none"
                      style={{
                        left: `${previewQr.x}%`,
                        top: `${previewQr.y}%`,
                        width: `${previewQr.w}%`,
                        height: `${previewQr.h}%`,
                      }}
                    >
                      <QrCode className="h-5 w-5 text-gold-700 drop-shadow" />
                    </div>
                  )}
                </div>
              )
            )}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Name</p>
                <p className="text-sm font-semibold text-slate-900">{previewTemplate.name}</p>
              </div>
              {previewTemplate.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                  <p className="text-sm text-slate-700">{previewTemplate.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">QR Position</p>
                <div className="grid grid-cols-4 gap-2 text-sm mt-1">
                  <div><span className="text-slate-500">X:</span> <span className="font-mono">{previewTemplate.theme_config?.qr_position?.x?.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">Y:</span> <span className="font-mono">{previewTemplate.theme_config?.qr_position?.y?.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">W:</span> <span className="font-mono">{previewTemplate.theme_config?.qr_position?.w?.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">H:</span> <span className="font-mono">{previewTemplate.theme_config?.qr_position?.h?.toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}