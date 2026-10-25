"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Save, Trash2, Eye, Edit3, CheckCircle2,
  Loader2, Image as ImageIcon, ArrowRight, ArrowLeft, Copy, Check, X,
} from "lucide-react";
import { Rnd } from "react-rnd";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { CardTemplateRecord, QrPosition, clampQrPosition, DEFAULT_QR_POSITION } from "@/types/cardTheme";

type SetupStep = "upload" | "position" | "review";

/** Renders the actual (transparent-background) QR that will be stamped at render time. */
function QrOverlayPreview({ payload, className }: { payload: string; className?: string }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      margin: 0,
      width: 256,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff00" },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload]);

  if (!src) return null;
  return <img src={src} alt="QR code preview" className={className} />;
}

export default function CardSetupPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isPlatformRole = !!user && ["superadmin", "platform_admin", "system_admin"].includes(String(user.role).trim().toLowerCase());
  const [step, setStep] = useState<SetupStep>("upload");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [frontImageLoading, setFrontImageLoading] = useState(false);
  const [frontFileId, setFrontFileId] = useState("");
  const [qrPos, setQrPos] = useState<QrPosition>({ ...DEFAULT_QR_POSITION });
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isGlobal, setIsGlobal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<CardTemplateRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Fetch existing templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: async () => {
      const res = await api.get("/cards/templates");
      return (res.data.data ?? []) as CardTemplateRecord[];
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api.post("/files/upload", form);
      const fileId = uploaded.data.data?.file_id ?? uploaded.data.data?.id;
      if (!fileId) throw new Error("Upload response did not include a file ID");
      return { fileId, previewUrl: URL.createObjectURL(file) };
    },
    onSuccess: (res) => {
      setFrontFileId(res.fileId);
      setFrontImage(res.previewUrl);
      toast.success("Design uploaded successfully!");
      setStep("position");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? "Upload failed");
    },
  });

  // Save template mutation (POST on create, PUT when editing an existing template)
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: any }) =>
      id ? api.put(`/cards/templates/${id}`, payload) : api.post("/cards/templates", payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["card-templates"] });
      toast.success(vars.id ? "Template updated successfully!" : "Template saved successfully!");
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? "Failed to save template");
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

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (template: CardTemplateRecord) =>
      api.post("/cards/templates", {
        name: `${template.name} (Copy)`,
        description: template.description,
        background_file_id: template.background_file_id,
        theme_config: template.theme_config,
        is_global: template.is_global,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card-templates"] });
      toast.success("Template duplicated");
    },
    onError: () => toast.error("Failed to duplicate template"),
  });

  const resetForm = () => {
    setStep("upload");
    setFrontImage(null);
    setFrontFileId("");
    setTemplateName("");
    setTemplateDescription("");
    setQrPos({ ...DEFAULT_QR_POSITION });
    setIsActive(true);
    setIsGlobal(false);
    setEditingId(null);
  };

  // Keep the QR box mapped to the real rendered canvas size (the background
  // image defines the canvas, so a fixed 800x600 assumption breaks on other ratios).
  useEffect(() => {
    if (step !== "position" || !frontImage) return;
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [step, frontImage]);

  useEffect(() => {
    // New templates created by platform roles default to the shared SaaS catalog.
    if (isPlatformRole && !editingId) setIsGlobal(true);
  }, [isPlatformRole, editingId]);

  useEffect(() => () => {
    if (frontImage?.startsWith("blob:")) URL.revokeObjectURL(frontImage);
  }, [frontImage]);

  const loadFileImage = async (fileId: string): Promise<string> => {
    const response = await api.get(`/files/${encodeURIComponent(fileId)}`, { responseType: "blob" });
    return URL.createObjectURL(response.data);
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

  const startEditing = async (template: CardTemplateRecord) => {
    if (!template.is_owned) {
      toast.error("Shared templates can't be edited here — use the preview instead");
      return;
    }
    const config = template.theme_config ?? {};
    const fileId = config.front_file_id ?? template.background_file_id ?? "";
    setEditingId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? "");
    setIsActive(template.is_active);
    setIsGlobal(template.is_global);
    setQrPos(clampQrPosition(config.qr_position));
    setFrontFileId(fileId);
    setFrontImage(null);
    setStep(fileId ? "position" : "upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (fileId) {
      setFrontImageLoading(true);
      try {
        setFrontImage(await loadFileImage(fileId));
      } catch {
        toast.error("Could not load the template background image");
      } finally {
        setFrontImageLoading(false);
      }
    }
  };

  const cancelEditing = () => resetForm();

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
    saveMutation.mutate({
      id: editingId,
      payload: {
        name: templateName,
        description: templateDescription,
        background_file_id: frontFileId,
        theme_config: {
          front_file_id: frontFileId,
          qr_position: qrPos,
        },
        is_active: isActive,
        is_global: isGlobal,
      },
    });
  };

  const copyTemplateId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Template ID copied");
  };

  const qrPreviewPayload =
    typeof window !== "undefined"
      ? `${window.location.origin}/g/QR-PREVIEW`
      : "https://example.com/g/QR-PREVIEW";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Card Template Studio</h1>
          <p className="text-slate-600">
            Upload your manually designed card and position the QR code for automatic guest personalization
          </p>
        </div>

        {/* Editing banner */}
        {editingId && (
          <div className="flex items-center justify-between px-4 py-3 mb-6 rounded-xl border border-gold-200 bg-gold-50">
            <p className="text-sm font-medium text-gold-900">
              Editing template: <span className="font-bold">{templateName || "…"}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={() => setStep(frontImage ? "position" : "upload")}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> Continue
              </Button>
            </div>
          </div>
        )}

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
                <span className={`ml-2 text-sm font-medium ${step === s ? "text-slate-900" : "text-slate-500"
                  }`}>
                  {s === "upload" ? "Upload Design" : s === "position" ? "Position QR" : "Review & Save"}
                </span>
                {idx < 2 && <div className="w-16 h-0.5 bg-slate-200 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <Card className="p-8 mb-8">
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
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.svg"
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
                      {editingId ? "Click to replace the card design" : "Click to upload your card design"}
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
          {step === "position" && (
            <div className="space-y-6">
              {frontImageLoading && !frontImage ? (
                <div className="flex flex-col items-center justify-center p-16">
                  <Loader2 className="h-10 w-10 text-gold-500 animate-spin" />
                  <p className="mt-3 text-sm text-slate-500">Loading template background…</p>
                </div>
              ) : frontImage ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Position QR Code</h3>
                      <p className="text-sm text-slate-500">
                        Drag and resize the yellow box to mark where the QR code should appear
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Change Image
                    </Button>
                  </div>

                  <div
                    ref={canvasRef}
                    className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-100 mx-auto max-w-2xl"
                  >
                    <img
                      src={frontImage}
                      alt="Card Design"
                      className="w-full h-auto block"
                      onLoad={() => {
                        const el = canvasRef.current;
                        if (el) setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
                      }}
                    />

                    {containerSize.w > 0 && (
                      <Rnd
                        size={{ width: `${qrPos.w}%`, height: `${qrPos.h}%` }}
                        position={{ x: (qrPos.x / 100) * containerSize.w, y: (qrPos.y / 100) * containerSize.h }}
                        onDragStop={(_, d) => {
                          const parent = d.node.parentNode as HTMLElement;
                          if (parent) {
                            setQrPos((p) => {
                              const x = Math.max(0, Math.min(100 - p.w, (d.x / parent.offsetWidth) * 100));
                              const y = Math.max(0, Math.min(100 - p.h, (d.y / parent.offsetHeight) * 100));
                              return { ...p, x, y };
                            });
                          }
                        }}
                        onResizeStop={(_, __, ref) => {
                          const parent = ref.parentNode as HTMLElement;
                          if (parent) {
                            setQrPos((p) => {
                              const w = Math.max(5, Math.min(50, (ref.offsetWidth / parent.offsetWidth) * 100));
                              const h = Math.max(5, Math.min(50, (ref.offsetHeight / parent.offsetHeight) * 100));
                              const x = Math.min(p.x, 100 - w);
                              const y = Math.min(p.y, 100 - h);
                              return { ...p, x, y, w, h };
                            });
                          }
                        }}
                        bounds="parent"
                        className="border-2 border-dashed border-gold-500 flex items-center justify-center cursor-move z-10"
                        style={{ minWidth: "40px", minHeight: "40px" }}
                      >
                        <div className="pointer-events-none w-full h-full p-1.5" title={`QR position — X ${qrPos.x.toFixed(1)}% · Y ${qrPos.y.toFixed(1)}% · ${qrPos.w.toFixed(1)}% × ${qrPos.h.toFixed(1)}%`}>
                          <QrOverlayPreview payload={qrPreviewPayload} className="w-full h-full" />
                        </div>
                      </Rnd>
                    )}
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

                  <div className="flex justify-between max-w-2xl mx-auto">
                    <Button variant="outline" onClick={() => setStep("upload")}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleSave}>
                      Continue to Review <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </>
              ) : null}
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
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded accent-gold-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Active — this template can be selected for events
                  </span>
                </label>
                {isPlatformRole && (
                  <div className="border-t border-slate-200 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGlobal}
                        onChange={(e) => setIsGlobal(e.target.checked)}
                        className="h-4 w-4 rounded accent-gold-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Share with all organizations (SaaS catalog)
                      </span>
                    </label>
                    <p className="text-xs text-slate-400 mt-1">
                      Shared templates can be selected by every event admin — they must be active to be visible.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setStep("position")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Adjust Position
                </Button>
                <Button onClick={confirmSave} isLoading={saveMutation.isPending} size="lg">
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
              {templates.map((t: CardTemplateRecord) => (
                <div key={t.id} className={`overflow-hidden group hover:shadow-lg transition-shadow rounded-xl border bg-white ${editingId === t.id ? "border-gold-400 ring-2 ring-gold-200" : "border-slate-200"}`}>
                  <div className="relative h-48 bg-slate-100">
                    <TemplateImage template={t} className="h-full w-full object-cover" />
                    <div className="absolute top-2 right-2">
                      <Badge
                        label={t.is_active ? "Active" : "Draft"}
                        variant={t.is_active ? "green" : "slate"}
                      />
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1">
                      {!t.is_owned && <Badge label="Shared" variant="gold" />}
                      {editingId === t.id && <Badge label="Editing" variant="gold" />}
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
                    <div className="flex gap-2 flex-wrap">
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
                        onClick={() => startEditing(t)}
                        disabled={!t.is_owned}
                        title={t.is_owned ? "Edit template" : "Shared templates can't be edited"}
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
                        onClick={() => duplicateMutation.mutate(t)}
                        title={t.is_owned ? "Duplicate template" : "Shared templates can't be duplicated"}
                        disabled={!t.is_owned}
                      >
                        <Copy className="h-3.5 w-3.5" />
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
                        disabled={!t.is_owned}
                        title={t.is_owned ? "Delete template" : "Shared templates can't be deleted"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
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
            <TemplateImage template={previewTemplate} className="max-h-[65vh] w-full rounded-lg border border-slate-200 object-contain" />
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase">Name</p>
                <Badge
                  label={previewTemplate.is_active ? "Active" : "Draft"}
                  variant={previewTemplate.is_active ? "green" : "slate"}
                />
              </div>
              <p className="text-sm font-semibold text-slate-900">{previewTemplate.name}</p>
              {previewTemplate.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                  <p className="text-sm text-slate-700">{previewTemplate.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">QR Position</p>
                <div className="grid grid-cols-4 gap-2 text-sm mt-1">
                  <div><span className="text-slate-500">X:</span> <span className="font-mono">{clampQrPosition(previewTemplate.theme_config?.qr_position).x.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">Y:</span> <span className="font-mono">{clampQrPosition(previewTemplate.theme_config?.qr_position).y.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">W:</span> <span className="font-mono">{clampQrPosition(previewTemplate.theme_config?.qr_position).w.toFixed(1)}%</span></div>
                  <div><span className="text-slate-500">H:</span> <span className="font-mono">{clampQrPosition(previewTemplate.theme_config?.qr_position).h.toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TemplateImage({ template, className }: { template: CardTemplateRecord; className: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fileId = template.theme_config?.front_file_id ?? template.background_file_id;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setImageUrl(null);
    setFailed(false);
    if (!fileId) return;

    api.get(`/files/${encodeURIComponent(fileId)}`, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setImageUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (imageUrl) return <img src={imageUrl} alt={template.name} className={className} />;
  return <div className={`${className} flex items-center justify-center bg-slate-100`}><ImageIcon className="h-12 w-12 text-slate-300" aria-label={failed ? "Background preview unavailable" : "Loading preview"} /></div>;
}