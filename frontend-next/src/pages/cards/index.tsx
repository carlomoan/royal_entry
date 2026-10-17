"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Save, QrCode, Trash2, Eye, Edit3, CheckCircle2,
  AlertCircle, Loader2, Image as ImageIcon, ArrowRight, ArrowLeft,
  Download, Copy, Check
} from "lucide-react";
import { Rnd } from "react-rnd";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge, Modal } from "@/components/ui";
import { CardTemplateConfig, QrPosition } from "@/types/cardTheme";

type SetupStep = "upload" | "position" | "review";

export default function CardSetupPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<SetupStep>("upload");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [frontFileId, setFrontFileId] = useState("");
  const [qrPos, setQrPos] = useState<QrPosition>({ x: 65, y: 75, w: 20, h: 20 });
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: async () => {
      const res = await api.get("/cards/templates");
      return res.data.data ?? [];
    },
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
      toast.error(err?.response?.data?.error?.message || "Upload failed");
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
    saveMutation.mutate({
      name: templateName,
      description: templateDescription,
      theme_config: {
        front_file_id: frontFileId,
        front_image_url: frontImage,
        qr_position: qrPos,
      },
      is_active: true,
    });
  };

  const copyTemplateId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Template ID copied");
  };

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
                    Drag and resize the yellow box to mark where the QR code should appear
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Change Image
                </Button>
              </div>

              <div className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-100 mx-auto max-w-2xl">
                <img
                  src={frontImage}
                  alt="Card Design"
                  className="w-full h-auto block"
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    console.log("Image loaded:", img.naturalWidth, "x", img.naturalHeight);
                  }}
                />

                <Rnd
                  size={{ width: `${qrPos.w}%`, height: `${qrPos.h}%` }}
                  position={{ x: (qrPos.x / 100) * 800, y: (qrPos.y / 100) * 600 }}
                  onDragStop={(_, d) => {
                    const parent = d.node.parentNode as HTMLElement;
                    if (parent) {
                      setQrPos((p) => ({
                        ...p,
                        x: Math.max(0, Math.min(100, (d.x as number / parent.offsetWidth) * 100)),
                        y: Math.max(0, Math.min(100, (d.y as number / parent.offsetHeight) * 100)),
                      }));
                    }
                  }}
                  onResizeStop={(_, __, ref) => {
                    const parent = ref.parentNode as HTMLElement;
                    if (parent) {
                      setQrPos((p) => ({
                        ...p,
                        w: Math.max(5, Math.min(50, (ref.offsetWidth / parent.offsetWidth) * 100)),
                        h: Math.max(5, Math.min(50, (ref.offsetHeight / parent.offsetHeight) * 100)),
                      }));
                    }
                  }}
                  bounds="parent"
                  className="border-2 border-dashed border-gold-500 bg-gold-500/20 flex items-center justify-center cursor-move z-10"
                  style={{ minWidth: "40px", minHeight: "40px" }}
                >
                  <div className="bg-white/90 rounded-full p-2 shadow-lg pointer-events-none">
                    <QrCode className="h-5 w-5 text-gold-700" />
                  </div>
                </Rnd>
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

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setStep("position")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Adjust Position
                </Button>
                <Button onClick={confirmSave} isLoading={saveMutation.isPending} size="lg">
                  <Save className="h-4 w-4 mr-2" /> Save Template
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
              {templates.map((t: any) => (
                <div key={t.id} className="overflow-hidden group hover:shadow-lg transition-shadow rounded-xl border border-slate-200 bg-white">
                  <div className="relative h-48 bg-slate-100">
                    {t.theme_config?.front_image_url ? (
                      <img
                        src={t.theme_config.front_image_url}
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewTemplate(t)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
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
            {previewTemplate.theme_config?.front_image_url && (
              <img
                src={previewTemplate.theme_config.front_image_url}
                alt={previewTemplate.name}
                className="w-full rounded-lg border border-slate-200"
              />
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