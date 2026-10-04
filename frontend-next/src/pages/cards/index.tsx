"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Type, Image as ImageIcon, QrCode, Square, Trash2, Copy, Eye, EyeOff,
  Lock, Unlock, Download, FileText, Save, Plus, Sparkles, Variable,
  AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown,
  ZoomIn, ZoomOut, Undo2, Redo2, ArrowLeft, FileImage, X, Layers,
} from "lucide-react";
import { Rnd } from "react-rnd";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Badge, Modal, Input, Select } from "@/components/ui";
import {
  RoyalCardTheme, CardPage, ThemeLayer,
  CARD_VARIABLES, emptyTheme, normalizeTheme, collectVariables,
} from "@/types/royal-card";
import { RoyalCardPage } from "@/components/cards/RoyalCard";

const DRAFT_KEY = "royal-card-studio-draft";

// ============================================================================
// PRESET — matches the reference card (ivory + botanical + gold, front/back)
// Image layers ship with empty src; the designer uploads the floral art /
// couple photo. Empty-src images render nothing until filled.
// ============================================================================
const GOLD = "#A9802E", GOLD_SOFT = "#B88952", GREEN = "#1F3D2B", IVORY = "#FBF6EA";

function baseLayer(partial: Partial<ThemeLayer> & Pick<ThemeLayer, "id" | "type">): ThemeLayer {
  return {
    x: 25, y: 25, w: 50, h: 10, rotation: 0, opacity: 100,
    locked: false, visible: true, ...partial,
  };
}

const PRESET_THEMES: RoyalCardTheme[] = [
  {
    version: 2, id: "swahili-ivory-gold", name: "Swahili Ivory & Gold",
    description: "Botanical ivory wedding with gold accents, front + check-in back",
    category: "wedding", createdBy: "system", isPublic: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    size: { width: 900, height: 1200 },
    variables: ["EVENT_CHARACTERS", "EVENT_DATE", "EVENT_VENUE", "EVENT_ADDRESS", "QR_CODE"],
    pages: [
      {
        id: "front", name: "Invitation",
        background: { type: "color", value: IVORY },
        layers: [
          baseLayer({ id: "f-floral-top", type: "image", name: "Floral frame (top)", x: 0, y: 0, w: 100, h: 22 }),
          baseLayer({ id: "f-floral-bottom", type: "image", name: "Floral frame (bottom)", x: 0, y: 80, w: 100, h: 20 }),
          baseLayer({ id: "f-families", type: "text", x: 20, y: 7, w: 60, h: 3, content: "TOGETHER WITH THEIR FAMILIES", fontSize: 12, fontFamily: "DM Sans", fontWeight: "500", color: GREEN, textAlign: "center", letterSpacing: 3 }),
          baseLayer({ id: "f-invited", type: "text", x: 15, y: 10, w: 70, h: 10, content: "You are Invited", fontSize: 54, fontFamily: "Great Vibes", fontWeight: "400", color: GOLD, textAlign: "center", curve: "arc-up" }),
          baseLayer({ id: "f-ceremony", type: "text", x: 25, y: 21, w: 50, h: 3, content: "TO THE WEDDING CEREMONY OF", fontSize: 12, fontFamily: "DM Sans", fontWeight: "500", color: GREEN, textAlign: "center", letterSpacing: 3 }),
          baseLayer({ id: "f-photo", type: "image", name: "Couple photo", x: 17, y: 26, w: 66, h: 34, radius: 170, fit: "cover" }),
          baseLayer({ id: "f-names", type: "text", x: 10, y: 62.5, w: 80, h: 8, content: "{{EVENT_CHARACTERS}}", fontSize: 46, fontFamily: "Playfair Display", fontWeight: "600", color: GREEN, textAlign: "center" }),
          baseLayer({ id: "f-date", type: "text", x: 10, y: 71.5, w: 80, h: 4, content: "{{EVENT_DATE}}", fontSize: 15, fontFamily: "DM Sans", fontWeight: "500", color: GREEN, textAlign: "center", letterSpacing: 4 }),
          baseLayer({ id: "f-divider", type: "shape", shapeType: "rectangle", x: 35, y: 77.5, w: 30, h: 0.35, shapeColor: GOLD_SOFT }),
          baseLayer({ id: "f-venue", type: "text", x: 15, y: 80, w: 70, h: 7, content: "{{EVENT_VENUE}}\n{{EVENT_ADDRESS}}", fontSize: 14, fontFamily: "DM Sans", fontWeight: "500", color: GREEN, textAlign: "center", letterSpacing: 2, lineHeight: 1.7 }),
          baseLayer({ id: "f-motto", type: "text", x: 25, y: 91, w: 50, h: 6, content: "Pamoja Daima, Milele", fontSize: 26, fontFamily: "Great Vibes", fontWeight: "400", color: GOLD, textAlign: "center" }),
        ],
      },
      {
        id: "back", name: "Check-in",
        background: { type: "color", value: IVORY },
        layers: [
          baseLayer({ id: "b-floral-top", type: "image", name: "Floral frame (top)", x: 0, y: 0, w: 100, h: 18 }),
          baseLayer({ id: "b-floral-bottom", type: "image", name: "Floral frame (bottom)", x: 0, y: 84, w: 100, h: 16 }),
          baseLayer({ id: "b-checkin", type: "text", x: 20, y: 9, w: 60, h: 4, content: "WEDDING CHECK-IN", fontSize: 17, fontFamily: "DM Sans", fontWeight: "600", color: GREEN, textAlign: "center", letterSpacing: 6 }),
          baseLayer({ id: "b-scan", type: "text", x: 20, y: 14, w: 60, h: 10, content: "Scan QR Code", fontSize: 52, fontFamily: "Great Vibes", fontWeight: "400", color: GREEN, textAlign: "center" }),
          baseLayer({ id: "b-hint", type: "text", x: 20, y: 25, w: 60, h: 5, content: "TO CHECK IN AND CONFIRM\nYOUR ATTENDANCE", fontSize: 11, fontFamily: "DM Sans", fontWeight: "500", color: GREEN, textAlign: "center", letterSpacing: 2, lineHeight: 1.7 }),
          baseLayer({ id: "b-qr", type: "qr", name: "Check-in QR", x: 28, y: 34, w: 44, h: 44, qrVariable: "QR_CODE" }),
          baseLayer({ id: "b-camera", type: "text", x: 20, y: 81, w: 60, h: 5, content: "OPEN YOUR CAMERA APP\nAND SCAN THE QR CODE", fontSize: 11, fontFamily: "DM Sans", fontWeight: "600", color: GREEN, textAlign: "center", letterSpacing: 2, lineHeight: 1.7 }),
          baseLayer({ id: "b-thanks", type: "text", x: 22, y: 90, w: 56, h: 7, content: "Thank you for being part\nof our special day", fontSize: 23, fontFamily: "Great Vibes", fontWeight: "400", color: GREEN, textAlign: "center", lineHeight: 1.4 }),
        ],
      },
    ],
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CardStudioPage() {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<"gallery" | "editor">("gallery");
  const [theme, setTheme] = useState<RoyalCardTheme>(emptyTheme());
  const [activePageId, setActivePageId] = useState("front");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.55);
  const [previewMode, setPreviewMode] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showPreviewData, setShowPreviewData] = useState(false);
  const [uploading, setUploading] = useState<"background" | "layer" | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<{ past: RoyalCardTheme[]; future: RoyalCardTheme[] }>({ past: [], future: [] });

  const { data: savedThemes = [] } = useQuery({
    queryKey: ["card-themes"],
    queryFn: async () => (await api.get("/cards/templates")).data.data ?? [],
  });

  const saveThemeMutation = useMutation({
    mutationFn: (payload: any) => api.post("/cards/templates", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["card-themes"] }); localStorage.removeItem(DRAFT_KEY); toast.success("Theme saved"); setView("gallery"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to save"),
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/cards/templates/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["card-themes"] }); localStorage.removeItem(DRAFT_KEY); toast.success("Theme updated"); setView("gallery"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to update"),
  });

  const currentPage = theme.pages.find((p) => p.id === activePageId) ?? theme.pages[0];
  const selectedLayer = currentPage?.layers.find((l) => l.id === selectedLayerId);

  // ------------------------------------------------------------ history
  const commit = useCallback((updater: (t: RoyalCardTheme) => RoyalCardTheme) => {
    setHistory((h) => ({ past: [...h.past.slice(-49), theme], future: [] }));
    setTheme(updater);
  }, [theme]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      setTheme(prev);
      setSelectedLayerId(null);
      return { past: h.past.slice(0, -1), future: [theme, ...h.future] };
    });
  }, [theme]);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h;
      const next = h.future[0];
      setTheme(next);
      setSelectedLayerId(null);
      return { past: [...h.past, theme], future: h.future.slice(1) };
    });
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "editor") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, undo, redo]);

  // ------------------------------------------------------------ autosave draft
  useEffect(() => {
    if (view !== "editor") return;
    const t = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(theme)), 1500);
    return () => clearTimeout(t);
  }, [theme, view]);

  // ------------------------------------------------------------ actions
  const resetTheme = () => {
    setTheme(emptyTheme());
    setActivePageId("front");
    setSelectedLayerId(null);
    setHistory({ past: [], future: [] });
  };

  const loadTheme = (raw: any) => {
    const t = normalizeTheme(raw.theme_config ? { ...raw.theme_config, id: raw.id, name: raw.name, description: raw.description, category: raw.category } : raw);
    setTheme({ ...t, id: raw.id ?? t.id, name: raw.name ?? t.name });
    setActivePageId(t.pages[0]?.id ?? "front");
    setSelectedLayerId(null);
    setHistory({ past: [], future: [] });
  };

  const addPage = () => {
    const id = `page_${Date.now().toString(36)}`;
    commit((t) => ({
      ...t,
      pages: [...t.pages, { id, name: `Page ${t.pages.length + 1}`, background: { type: "color", value: "#FBF6EA" }, layers: [] }],
    }));
    setActivePageId(id);
  };

  const removePage = (pageId: string) => {
    if (theme.pages.length <= 1) return toast.error("A theme needs at least one page");
    commit((t) => ({ ...t, pages: t.pages.filter((p) => p.id !== pageId) }));
    if (activePageId === pageId) setActivePageId(theme.pages.find((p) => p.id !== pageId)?.id ?? "front");
  };

  const updatePage = (pageId: string, updates: Partial<CardPage>) =>
    commit((t) => ({ ...t, pages: t.pages.map((p) => (p.id === pageId ? { ...p, ...updates } : p)) }));

  const updateLayer = (layerId: string, updates: Partial<ThemeLayer>) =>
    updatePage(currentPage.id, { layers: currentPage.layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l)) });

  const deleteLayer = (layerId: string) => {
    updatePage(currentPage.id, { layers: currentPage.layers.filter((l) => l.id !== layerId) });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const duplicateLayer = (layerId: string) => {
    const src = currentPage.layers.find((l) => l.id === layerId);
    if (!src) return;
    const copy = { ...src, id: `layer_${Date.now().toString(36)}`, x: Math.min(src.x + 3, 95), y: Math.min(src.y + 3, 95), name: src.name ? `${src.name} copy` : undefined };
    updatePage(currentPage.id, { layers: [...currentPage.layers, copy] });
    setSelectedLayerId(copy.id);
  };

  const moveLayer = (layerId: string, dir: "up" | "down") => {
    const idx = currentPage.layers.findIndex((l) => l.id === layerId);
    const j = dir === "up" ? idx + 1 : idx - 1; // "up" = later in array = visually on top
    if (idx < 0 || j < 0 || j >= currentPage.layers.length) return;
    const layers = [...currentPage.layers];
    [layers[idx], layers[j]] = [layers[j], layers[idx]];
    updatePage(currentPage.id, { layers });
  };

  const addLayer = (type: ThemeLayer["type"], preset: Partial<ThemeLayer> = {}): string => {
    const id = `layer_${Date.now().toString(36)}`;
    const defaults: Partial<ThemeLayer> =
      type === "text" ? { x: 20, y: 20, w: 60, h: 8, content: "New text", fontSize: 24, fontFamily: "DM Sans", fontWeight: "400", color: GREEN, textAlign: "center", curve: "none" }
      : type === "shape" ? { x: 35, y: 45, w: 30, h: 4, shapeType: "rectangle", shapeColor: GOLD_SOFT }
      : type === "qr" ? { x: 38, y: 38, w: 24, h: 24, qrVariable: "QR_CODE" }
      : { x: 25, y: 30, w: 50, h: 30, fit: "cover", radius: 0 };
    updatePage(currentPage.id, { layers: [...currentPage.layers, baseLayer({ id, type, ...defaults, ...preset })] });
    setSelectedLayerId(id);
    return id;
  };

  const insertVariable = (key: string) => {
    if (!selectedLayer || selectedLayer.type !== "text") return;
    updateLayer(selectedLayer.id, { content: (selectedLayer.content ?? "") + `{{${key}}}` });
    setShowVariablePicker(false);
  };

  const uploadFile = async (file: File): Promise<{ url: string; fileId?: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/files/upload", form);
    const d = res.data.data ?? {};
    return { url: d.url ?? d.path ?? URL.createObjectURL(file), fileId: d.file_id ?? d.id };
  };

  const handleBackgroundUpload = async (file: File) => {
    setUploading("background");
    try {
      const { url, fileId } = await uploadFile(file);
      updatePage(currentPage.id, { background: { type: "image", value: url, fileId } });
      toast.success("Background uploaded");
    } catch { toast.error("Failed to upload background"); }
    finally { setUploading(null); }
  };

  const handleImageLayerUpload = async (file: File, layerId?: string) => {
    setUploading("layer");
    const objectUrl = URL.createObjectURL(file);
    const targetId = layerId ?? addLayer("image", { src: objectUrl });
    try {
      const { url, fileId } = await uploadFile(file);
      updateLayer(targetId, { src: url, fileId });
      toast.success("Image uploaded");
    } catch { toast.error("Failed to upload image"); }
    finally { setUploading(null); }
  };

  const saveAsTheme = () => {
    const payload = {
      name: theme.name, description: theme.description, category: theme.category,
      theme_config: { ...theme, variables: collectVariables(theme) },
    };
    if (theme.id && !theme.id.startsWith("custom_")) updateThemeMutation.mutate({ id: theme.id, payload });
    else saveThemeMutation.mutate(payload);
  };

  // html2canvas fallback export. Scale compensates for editor zoom so output
  // is always at the theme's true pixel size (×2 for retina).
  const exportCard = async (format: "png" | "jpeg" | "pdf") => {
    if (!canvasRef.current) return;
    try {
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2 / zoom, useCORS: true, allowTaint: true, backgroundColor: null,
      });
      if (format === "pdf") {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [theme.size.width, theme.size.height] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, theme.size.width, theme.size.height);
        pdf.save(`${theme.name.replace(/\s+/g, "_")}.pdf`);
      } else {
        const link = document.createElement("a");
        link.download = `${theme.name.replace(/\s+/g, "_")}.${format}`;
        link.href = canvas.toDataURL(`image/${format}`, 0.95);
        link.click();
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch { toast.error("Export failed — install the server render route for reliable output"); }
  };

  // ============================================================================
  // INTERACTIVE LAYER (editor chrome: selection, drag, resize, inline edit)
  // ============================================================================
  const cw = theme.size.width, ch = theme.size.height;

  const renderInteractiveLayer = (layer: ThemeLayer) => {
    if (!layer.visible) return null;
    const isSelected = selectedLayerId === layer.id;
    const boxStyle: React.CSSProperties = {
      outline: isSelected ? "2px solid #d4af37" : "1px dashed rgba(100,116,139,0.35)",
      background: isSelected ? "rgba(212,175,55,0.06)" : "transparent",
      pointerEvents: layer.locked ? "none" : "auto",
    };

    return (
      <Rnd
        key={layer.id}
        scale={zoom}
        bounds="parent"
        disableDragging={layer.locked}
        enableResizing={layer.locked ? false : undefined}
        lockAspectRatio={layer.type === "qr" || (layer.type === "image" && (layer.fit ?? "cover") === "cover") ? undefined : false}
        size={{ width: (layer.w / 100) * cw, height: (layer.h / 100) * ch }}
        position={{ x: (layer.x / 100) * cw, y: (layer.y / 100) * ch }}
        onDragStart={() => setSelectedLayerId(layer.id)}
        onDragStop={(_, d) => updateLayer(layer.id, {
          x: +((d.x / cw) * 100).toFixed(2),
          y: +((d.y / ch) * 100).toFixed(2),
        })}
        onResizeStop={(_, __, ref, ___, pos) => updateLayer(layer.id, {
          w: +((ref.offsetWidth / cw) * 100).toFixed(2),
          h: +((ref.offsetHeight / ch) * 100).toFixed(2),
          x: +((pos.x / cw) * 100).toFixed(2),
          y: +((pos.y / ch) * 100).toFixed(2),
        })}
        onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
        onDoubleClick={() => layer.type === "text" && !layer.locked && setEditingTextId(layer.id)}
      >
        <div style={{ ...boxStyle, width: "100%", height: "100%", overflow: "hidden" }}>
          {renderLayerContent(layer, isSelected)}
        </div>
      </Rnd>
    );
  };

  const renderLayer = (layer: ThemeLayer, pageIndex: number) => {
    if (!layer.visible) return null;

    // ✅ FIX: Safely get canvas dimensions, defaulting to theme size if ref is missing
    const cw = canvasRef.current?.offsetWidth || theme.size.width;
    const ch = canvasRef.current?.offsetHeight || theme.size.height;

    // Prevent NaN by ensuring cw/ch are never 0
    const safeW = cw > 0 ? cw : 900;
    const safeH = ch > 0 ? ch : 1200;

    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: `${layer.x}%`,
      top: `${layer.y}%`,
      width: `${layer.w}%`,
      height: `${layer.h}%`,
      transform: `rotate(${layer.rotation}deg)`,
      opacity: layer.opacity / 100,
      zIndex: layer.zIndex || 0,
    };

  // ============================================================================
  // GALLERY
  // ============================================================================
  if (view === "gallery") {
    const draft = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Card Templates</h1>
            <p className="text-sm text-slate-500">Design invitation & check-in cards with the visual studio</p>
          </div>
          <Button onClick={() => { resetTheme(); setView("editor"); }}>
            <Plus className="h-4 w-4 mr-2" /> Create New Template
          </Button>
        </div>

        {draft && (
          <button onClick={() => { loadTheme(JSON.parse(draft)); setView("editor"); }}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-gold-400 bg-gold-50 p-4 text-left transition hover:bg-gold-100">
            <Sparkles className="h-5 w-5 text-gold-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Restore unsaved draft</p>
              <p className="text-xs text-slate-500">You have an auto-saved theme from your last session</p>
            </div>
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRESET_THEMES.map((preset) => (
            <button key={preset.id} onClick={() => { loadTheme(preset); setView("editor"); }}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-gold-400 hover:bg-gold-50 text-left transition shadow-sm">
              <div className="h-32 rounded-lg mb-3 flex items-center justify-center" style={{ backgroundColor: preset.pages[0].background.value }}>
                <Sparkles className="h-8 w-8 text-slate-400" />
              </div>
              <p className="font-semibold text-sm text-slate-900">{preset.name}</p>
              <p className="text-xs text-slate-500">{preset.description}</p>
              <Badge label="Preset" variant="gold" className="mt-2" />
            </button>
          ))}

          {savedThemes.map((t: any) => (
            <button key={t.id} onClick={() => { loadTheme(t); setView("editor"); }}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-gold-400 hover:bg-gold-50 text-left transition shadow-sm">
              <div className="h-32 rounded-lg mb-3 bg-slate-100 flex items-center justify-center">
                <Layers className="h-8 w-8 text-slate-400" />
              </div>
              <p className="font-semibold text-sm text-slate-900">{t.name}</p>
              <p className="text-xs text-slate-500">{t.description || "Saved theme"}</p>
              <Badge label="Saved" variant="blue" className="mt-2" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // EDITOR
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("gallery")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Gallery
          </Button>
          <Sparkles className="h-5 w-5 text-gold-600" />
          <div>
            <input value={theme.name} onChange={(e) => setTheme({ ...theme, name: e.target.value })}
              className="text-lg font-bold text-slate-900 bg-transparent border-none outline-none" placeholder="Theme name" />
            <p className="text-xs text-slate-500">
              {theme.pages.length} page{theme.pages.length > 1 ? "s" : ""} · {theme.size.width}×{theme.size.height}px · {currentPage?.layers.length ?? 0} layers on this page
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!history.past.length} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
          <div className="flex items-center gap-1 border border-slate-200 rounded-md px-1">
            <button onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))} className="p-1.5 hover:bg-slate-100 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
            <span className="text-xs w-11 text-center text-slate-600">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} className="p-1.5 hover:bg-slate-100 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
          </div>
          <Button variant={previewMode ? "primary" : "outline"} size="sm" onClick={() => { setPreviewMode(!previewMode); setSelectedLayerId(null); }}>
            <Eye className="h-4 w-4 mr-1" /> {previewMode ? "Exit Preview" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreviewData(true)}>
            <Variable className="h-4 w-4 mr-1" /> Preview Data
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCard("png")}><Download className="h-4 w-4 mr-1" /> PNG</Button>
          <Button variant="outline" size="sm" onClick={() => exportCard("pdf")}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          <Button size="sm" onClick={saveAsTheme} isLoading={saveThemeMutation.isPending || updateThemeMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save Theme
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Left: pages + layers */}
        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
          {/* Page tabs */}
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pages</p>
              <button onClick={addPage} className="p-1 hover:bg-slate-100 rounded" title="Add page"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {theme.pages.map((p) => (
                <div key={p.id} className={`group flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${p.id === currentPage.id ? "border-gold-400 bg-gold-50 text-gold-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  <span onClick={() => { setActivePageId(p.id); setSelectedLayerId(null); }}>{p.name}</span>
                  {theme.pages.length > 1 && (
                    <button onClick={() => removePage(p.id)} className="opacity-0 group-hover:opacity-100 text-rose-500"><X className="h-3 w-3" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add layer */}
          <div className="p-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Add Layer</p>
            <div className="grid grid-cols-4 gap-1">
              <button onClick={() => addLayer("text")} className="p-2 rounded border border-slate-200 hover:bg-gold-50 hover:border-gold-300" title="Text"><Type className="h-4 w-4 mx-auto" /></button>
              <button onClick={() => addLayer("shape")} className="p-2 rounded border border-slate-200 hover:bg-gold-50 hover:border-gold-300" title="Shape"><Square className="h-4 w-4 mx-auto" /></button>
              <button onClick={() => addLayer("qr")} className="p-2 rounded border border-slate-200 hover:bg-gold-50 hover:border-gold-300" title="QR Code"><QrCode className="h-4 w-4 mx-auto" /></button>
              <label className="p-2 rounded border border-slate-200 hover:bg-gold-50 hover:border-gold-300 cursor-pointer" title="Image layer">
                <ImageIcon className="h-4 w-4 mx-auto" />
                <input type="file" accept="image/*" className="sr-only" disabled={uploading === "layer"}
                  onChange={(e) => e.target.files?.[0] && handleImageLayerUpload(e.target.files[0])} />
              </label>
            </div>
            {uploading && <p className="text-[10px] text-slate-500 mt-1">Uploading…</p>}
          </div>

          {/* Layer list */}
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Layers · {currentPage?.name} ({currentPage?.layers.length ?? 0})</p>
            <div className="space-y-1">
              {[...(currentPage?.layers ?? [])].reverse().map((layer) => (
                <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs ${selectedLayerId === layer.id ? "bg-gold-50 border border-gold-300" : "hover:bg-slate-50 border border-transparent"}`}>
                  {layer.type === "text" && <Type className="h-3 w-3 text-slate-400" />}
                  {layer.type === "shape" && <Square className="h-3 w-3 text-slate-400" />}
                  {layer.type === "qr" && <QrCode className="h-3 w-3 text-slate-400" />}
                  {layer.type === "image" && <FileImage className="h-3 w-3 text-slate-400" />}
                  <span className="flex-1 truncate">{layer.name ?? (layer.content ? layer.content.replace(/\{\{(\w+)\}\}/g, "[$1]").slice(0, 22) : layer.type)}</span>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, "up"); }} title="Bring forward" className="p-1 hover:bg-slate-200 rounded"><ChevronUp className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, "down"); }} title="Send backward" className="p-1 hover:bg-slate-200 rounded"><ChevronDown className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className="p-1 hover:bg-slate-200 rounded">
                    {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }} className="p-1 hover:bg-slate-200 rounded">
                    {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="p-1 hover:bg-rose-100 rounded text-rose-600"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {currentPage?.layers.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No layers yet — add one above</p>}
            </div>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="flex-1 overflow-auto bg-slate-100 p-8">
          {previewMode ? (
            <div className="flex flex-col items-center gap-6 mx-auto" style={{ width: cw * zoom }}>
              {theme.pages.map((p) => (
                <div key={p.id}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 text-center">{p.name}</p>
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
                    <RoyalCardPage page={p} data={previewData} width={cw} height={ch} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center" style={{ minWidth: cw * zoom + 64 }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", marginBottom: ch * (zoom - 1) }}>
                <div
                  ref={canvasRef}
                  onClick={() => setSelectedLayerId(null)}
                  className="relative shadow-2xl bg-white"
                  style={{
                    width: cw, height: ch,
                    backgroundColor: currentPage?.background.type === "color" ? currentPage.background.value : undefined,
                    backgroundImage: currentPage?.background.type === "image" ? `url(${currentPage.background.value})` : undefined,
                    backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
                  }}
                >
                  {currentPage?.background.overlay && <div style={{ position: "absolute", inset: 0, background: currentPage.background.overlay, pointerEvents: "none" }} />}
                  {currentPage?.layers.map(renderInteractiveLayer)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: properties */}
        {selectedLayer && !previewMode && (
          <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <input value={selectedLayer.name ?? ""} placeholder="Layer name"
                  onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value })}
                  className="text-sm font-semibold text-slate-900 bg-transparent border-none outline-none w-40" />
                <Badge label={selectedLayer.type} variant="blue" />
              </div>
              <p className="text-xs text-slate-500">ID: {selectedLayer.id.slice(-8)}</p>
            </div>

            {/* ---- text props ---- */}
            {selectedLayer.type === "text" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Content (double-click layer to edit inline)</label>
                  <textarea value={selectedLayer.content ?? ""} rows={4}
                    onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <button onClick={() => setShowVariablePicker(true)}
                    className="mt-1 text-xs text-gold-700 hover:underline flex items-center gap-1">
                    <Variable className="h-3 w-3" /> Insert variable
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Text Shape</label>
                  <select value={selectedLayer.curve ?? "none"}
                    onChange={(e) => updateLayer(selectedLayer.id, { curve: e.target.value as any })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="none">Straight</option>
                    <option value="arc-up">Arc Up</option>
                    <option value="arc-down">Arc Down</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Font Size</label>
                    <input type="number" value={selectedLayer.fontSize ?? 18}
                      onChange={(e) => updateLayer(selectedLayer.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Color</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input type="color" value={selectedLayer.color ?? "#1F3D2B"}
                        onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                        className="h-7 w-10 rounded border border-slate-300" />
                      <input type="text" value={selectedLayer.color ?? ""}
                        onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Font Family</label>
                  <select value={selectedLayer.fontFamily ?? "DM Sans"}
                    onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                    <option>Playfair Display</option><option>Great Vibes</option><option>DM Sans</option><option>Georgia</option><option>Arial</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Weight</label>
                    <select value={selectedLayer.fontWeight ?? "400"}
                      onChange={(e) => updateLayer(selectedLayer.id, { fontWeight: e.target.value })}
                      className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                      <option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semi-bold</option><option value="700">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Line Height</label>
                    <input type="number" step={0.1} value={selectedLayer.lineHeight ?? 1.2}
                      onChange={(e) => updateLayer(selectedLayer.id, { lineHeight: parseFloat(e.target.value) })}
                      className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Alignment</label>
                  <div className="flex gap-1 mt-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} onClick={() => updateLayer(selectedLayer.id, { textAlign: a })}
                        className={`flex-1 p-1.5 rounded border ${selectedLayer.textAlign === a ? "bg-gold-50 border-gold-300" : "border-slate-300"}`}>
                        {a === "left" ? <AlignLeft className="h-3 w-3 mx-auto" /> : a === "center" ? <AlignCenter className="h-3 w-3 mx-auto" /> : <AlignRight className="h-3 w-3 mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Letter Spacing ({selectedLayer.letterSpacing ?? 0}px)</label>
                  <input type="range" min={0} max={12} value={selectedLayer.letterSpacing ?? 0}
                    onChange={(e) => updateLayer(selectedLayer.id, { letterSpacing: parseInt(e.target.value) })}
                    className="w-full mt-1" />
                </div>
              </div>
            )}

            {/* ---- image props ---- */}
            {selectedLayer.type === "image" && (
              <div className="p-4 space-y-3">
                {selectedLayer.src && (
                  <img src={selectedLayer.src} alt="" className="w-full h-28 object-cover rounded border border-slate-200" />
                )}
                <label className="block w-full cursor-pointer rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-600 hover:border-gold-400 hover:bg-gold-50">
                  {selectedLayer.src ? "Replace image" : "Upload image"}
                  <input type="file" accept="image/*" className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleImageLayerUpload(e.target.files[0], selectedLayer.id)} />
                </label>
                <div>
                  <label className="text-xs text-slate-600">Fit</label>
                  <select value={selectedLayer.fit ?? "cover"}
                    onChange={(e) => updateLayer(selectedLayer.id, { fit: e.target.value as any })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="cover">Cover (fill, crop)</option>
                    <option value="contain">Contain (fit inside)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Corner Radius ({selectedLayer.radius ?? 0}px)</label>
                  <input type="range" min={0} max={300} value={selectedLayer.radius ?? 0}
                    onChange={(e) => updateLayer(selectedLayer.id, { radius: parseInt(e.target.value) })}
                    className="w-full mt-1" />
                </div>
              </div>
            )}

            {/* ---- shape props ---- */}
            {selectedLayer.type === "shape" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-600">Shape Type</label>
                  <select value={selectedLayer.shapeType ?? "rectangle"}
                    onChange={(e) => updateLayer(selectedLayer.id, { shapeType: e.target.value as any })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="rectangle">Rectangle / Line</option>
                    <option value="ellipse">Ellipse</option>
                    <option value="star">Star</option>
                    <option value="hexagon">Hexagon</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Fill Color</label>
                  <input type="color" value={selectedLayer.shapeColor ?? "#B88952"}
                    onChange={(e) => updateLayer(selectedLayer.id, { shapeColor: e.target.value })}
                    className="w-full mt-1 h-8 rounded border border-slate-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Border Color</label>
                    <input type="color" value={selectedLayer.shapeBorder ?? "#000000"}
                      onChange={(e) => updateLayer(selectedLayer.id, { shapeBorder: e.target.value })}
                      className="w-full mt-1 h-8 rounded border border-slate-300" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Border Width</label>
                    <input type="number" value={selectedLayer.shapeBorderWidth ?? 0}
                      onChange={(e) => updateLayer(selectedLayer.id, { shapeBorderWidth: parseInt(e.target.value) })}
                      className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                </div>
              </div>
            )}

            {/* ---- qr props ---- */}
            {selectedLayer.type === "qr" && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-600">QR Payload Variable</label>
                  <select value={selectedLayer.qrVariable ?? "QR_CODE"}
                    onChange={(e) => updateLayer(selectedLayer.id, { qrVariable: e.target.value })}
                    className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                    {CARD_VARIABLES.filter((v) => v.category === "System" || v.key === "QR_CODE").map((v) => (
                      <option key={v.key} value={v.key}>{v.label} ({"{{" + v.key + "}})"}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Resolved per-guest from the invitation record at render time.</p>
                </div>
              </div>
            )}

            {/* ---- common props ---- */}
            <div className="p-4 border-t border-slate-200 space-y-3">
              <p className="text-xs font-semibold text-slate-600">Position & Size (% of page)</p>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <div key={k}>
                    <label className="text-xs text-slate-600 uppercase">{k}</label>
                    <input type="number" step={0.5} value={selectedLayer[k]}
                      onChange={(e) => updateLayer(selectedLayer.id, { [k]: parseFloat(e.target.value) })}
                      className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-600">Rotation ({selectedLayer.rotation}°)</label>
                <input type="range" min={-180} max={180} value={selectedLayer.rotation}
                  onChange={(e) => updateLayer(selectedLayer.id, { rotation: parseInt(e.target.value) })}
                  className="w-full mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Opacity ({selectedLayer.opacity}%)</label>
                <input type="range" min={0} max={100} value={selectedLayer.opacity}
                  onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseInt(e.target.value) })}
                  className="w-full mt-1" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => duplicateLayer(selectedLayer.id)} className="flex-1">
                  <Copy className="h-3 w-3 mr-1" /> Duplicate
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteLayer(selectedLayer.id)} className="flex-1">
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Right: page properties when nothing selected */}
        {!selectedLayer && !previewMode && (
          <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-900">Page Settings</p>
              <p className="text-xs text-slate-500 mt-0.5">{currentPage?.name}</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-600">Page name</label>
                <input value={currentPage?.name ?? ""}
                  onChange={(e) => updatePage(currentPage.id, { name: e.target.value })}
                  className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Background</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={currentPage?.background.type === "color" ? currentPage.background.value : "#FBF6EA"}
                    onChange={(e) => updatePage(currentPage.id, { background: { type: "color", value: e.target.value } })}
                    className="h-8 w-12 rounded border border-slate-300" />
                  <span className="text-xs text-slate-500 flex-1">
                    {currentPage?.background.type === "image" ? "Image background" : "Solid color"}
                  </span>
                  {currentPage?.background.type === "image" && (
                    <button onClick={() => updatePage(currentPage.id, { background: { type: "color", value: "#FBF6EA" } })}
                      className="text-xs text-rose-600 hover:underline">Remove</button>
                  )}
                </div>
              </div>
              <label className="block w-full cursor-pointer rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-600 hover:border-gold-400 hover:bg-gold-50">
                {uploading === "background" ? "Uploading…" : "Upload background image"}
                <input type="file" accept="image/*" className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleBackgroundUpload(e.target.files[0])} />
              </label>
              <div>
                <label className="text-xs text-slate-600">Description</label>
                <textarea value={theme.description} rows={2}
                  onChange={(e) => setTheme({ ...theme, description: e.target.value })}
                  className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Category</label>
                <select value={theme.category}
                  onChange={(e) => setTheme({ ...theme, category: e.target.value as any })}
                  className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="wedding">Wedding</option><option value="graduation">Graduation</option>
                  <option value="corporate">Corporate</option><option value="birthday">Birthday</option><option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Variable picker */}
      <Modal isOpen={showVariablePicker} onClose={() => setShowVariablePicker(false)} title="Insert Variable" size="md">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {["Guest", "Event", "System"].map((cat) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{cat}</p>
              <div className="grid grid-cols-2 gap-1">
                {CARD_VARIABLES.filter((v) => v.category === cat).map((v) => (
                  <button key={v.key} onClick={() => insertVariable(v.key)}
                    className="p-2 rounded border border-slate-200 hover:border-gold-400 hover:bg-gold-50 text-left">
                    <p className="text-xs font-mono font-semibold text-gold-700">{"{{" + v.key + "}}"}</p>
                    <p className="text-[10px] text-slate-500">{v.label}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Preview data */}
      <Modal isOpen={showPreviewData} onClose={() => setShowPreviewData(false)} title="Preview Variable Values" size="md">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <p className="text-xs text-slate-600">Sample values used in the editor preview and in Preview mode.</p>
          {CARD_VARIABLES.map((v) => (
            <div key={v.key}>
              <label className="text-xs font-medium text-slate-700">{v.label} <span className="text-slate-400 font-mono">{"{{" + v.key + "}}"}</span></label>
              <input type="text" value={previewData[v.key] ?? ""} placeholder={v.label}
                onChange={(e) => setPreviewData({ ...previewData, [v.key]: e.target.value })}
                className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs" />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
