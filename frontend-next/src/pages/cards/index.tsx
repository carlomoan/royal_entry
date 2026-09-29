"use client";
import "@fontsource/playfair-display/600.css";
import "@fontsource/great-vibes/400.css";
import "@fontsource/dm-sans/400.css";
import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Download, FileText, ImagePlus, Mail, Move, Palette, Send, Smartphone, Sparkles,
  Type, AlignLeft, AlignCenter, AlignRight, Plus, Trash2, Hexagon, Circle, Square,
  Variable, Layers, Edit3, Copy, RotateCw,
} from "lucide-react";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Badge, Button, Card, Select, Input, Modal } from "@/components/ui";

// ============================================================================
// TYPES
// ============================================================================
type Design = {
  id: string;
  name: string;
  description: string;
  background: string;
  ink: string;
  accent: string;
  font: string;
  previewImage?: string;
  sourceId?: string;
  presetContent?: PresetContent;
};

type PresetContent = {
  customTexts: Omit<CustomTextLayer, "id">[];
  positions: Record<string, { x: number; y: number }>;
  textConfigs: Record<string, TextLayerConfig>;
};

type Layer = "title" | "guest" | "date" | "venue" | "qr" | "icon" | "frame" | "polygon" | "custom";
type TextAlign = "left" | "center" | "right";
type FrameType = "none" | "rectangle" | "ellipse" | "flower";
type PolygonType = "triangle" | "pentagon" | "hexagon" | "star";
type TextShape = "straight" | "arc-up" | "arc-down" | "circle" | "wave";

type TextLayerConfig = {
  fontSize: number;
  color: string;
  fontFamily: string;
  textAlign: TextAlign;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
};

type CustomTextLayer = {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: TextAlign;
  letterSpacing: number;
  lineHeight: number;
  shape: TextShape;
  arcRadius: number;
  rotation: number;
  maxWidth: number;
  visible: boolean;
};

type IconLayer = {
  id: string;
  icon: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
};

type FrameLayer = {
  type: FrameType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderWidth: number;
  borderColor: string;
  rotation: number;
};

type PolygonLayer = {
  id: string;
  type: PolygonType;
  x: number;
  y: number;
  size: number;
  color: string;
  borderColor: string;
  borderWidth: number;
  rotation: number;
  sides?: number;
};

// ============================================================================
// DATABASE VARIABLES (fetched from backend at render time)
// ============================================================================
const VARIABLES = [
  { key: "GUEST_NAME", label: "Jina la Mgeni", example: "Ndugu John Doe", category: "Mgeni" },
  { key: "GUEST_SEATNO", label: "Namba ya Kiti", example: "A-12", category: "Mgeni" },
  { key: "GUEST_TABLE", label: "Meza ya Mgeni", example: "Meza 5", category: "Mgeni" },
  { key: "GUEST_CATEGORY", label: "Aina ya Mgeni", example: "VIP", category: "Mgeni" },
  { key: "EVENT_TYPE", label: "Aina ya Sherehe", example: "Harusi", category: "Sherehe" },
  { key: "EVENT_TITLE", label: "Kichwa cha Sherehe", example: "Harusi ya Mary na Joseph", category: "Sherehe" },
  { key: "EVENT_CHARACTER_NAME1", label: "Jina la Kijana 1", example: "Mary", category: "Sherehe" },
  { key: "EVENT_CHARACTER_NAME2", label: "Jina la Kijana 2", example: "Joseph", category: "Sherehe" },
  { key: "EVENT_VENUE", label: "Ukumbi", example: "White Sands Hotel", category: "Sherehe" },
  { key: "EVENT_DATE", label: "Tarehe", example: "tarehe 25 Desemba 2026", category: "Sherehe" },
  { key: "EVENT_START_TIME", label: "Muda wa Kuanza", example: "Saa 6:00 alasiri", category: "Sherehe" },
  { key: "EVENT_END_TIME", label: "Muda wa Kuisha", example: "Saa 12:00 usiku", category: "Sherehe" },
  { key: "EVENT_REPORTING_TIME", label: "Muda wa Kufika", example: "Saa 5:30 alasiri", category: "Sherehe" },
  { key: "CHURCH", label: "Kanisa", example: "Kanisa la Nuru", category: "Sherehe" },
  { key: "EVENT_ORGANISATION_NAME", label: "Jina la Familia", example: "Mwanga", category: "Sherehe" },
  { key: "QR_CODE", label: "QR Code (Check-in)", example: "[QR]", category: "Mfumo" },
];

// ============================================================================
// PRESET TEMPLATES
// ============================================================================
const SWAHILI_WEDDING_PRESET: PresetContent = {
  positions: {
    title: { x: 50, y: 8 },
    guest: { x: 50, y: 78 },
    date: { x: 50, y: 88 },
    venue: { x: 50, y: 93 },
    qr: { x: 50, y: 68 },
  },
  textConfigs: {
    title: { fontSize: 28, color: "", fontFamily: "Playfair Display", textAlign: "center", fontWeight: "600", letterSpacing: 2, lineHeight: 1.3 },
    guest: { fontSize: 20, color: "", fontFamily: "Great Vibes", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
    date: { fontSize: 14, color: "", fontFamily: "DM Sans", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
    venue: { fontSize: 13, color: "", fontFamily: "DM Sans", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
  },
  customTexts: [
    {
      content: "Familia ya Bw. na Bi. [EVENT_ORGANISATION_NAME]",
      x: 50, y: 15, fontSize: 14, color: "", fontFamily: "Playfair Display",
      fontWeight: "600", textAlign: "center", letterSpacing: 1, lineHeight: 1.3,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 80, visible: true,
    },
    {
      content: "Wanayofuraha kukukaribisha",
      x: 50, y: 22, fontSize: 12, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 80, visible: true,
    },
    {
      content: "Ndugu/Jamaa/Rafiki",
      x: 50, y: 28, fontSize: 11, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 80, visible: true,
    },
    {
      content: "[GUEST_NAME]",
      x: 50, y: 36, fontSize: 32, color: "", fontFamily: "Great Vibes",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 80, visible: true,
    },
    {
      content: "Katika Sherehe ya [EVENT_TYPE]",
      x: 50, y: 46, fontSize: 13, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "ya Kijana wao [EVENT_CHARACTER_NAME1]",
      x: 50, y: 50, fontSize: 13, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "anayetarajia kufunga ndoa na [EVENT_CHARACTER_NAME2]",
      x: 50, y: 54, fontSize: 13, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 90, visible: true,
    },
    {
      content: "katika kanisa la [CHURCH]",
      x: 50, y: 58, fontSize: 13, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "Ukumbi: [EVENT_VENUE], Njombe",
      x: 50, y: 82, fontSize: 12, color: "", fontFamily: "DM Sans",
      fontWeight: "500", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "Tarehe: [EVENT_DATE]",
      x: 50, y: 86, fontSize: 12, color: "", fontFamily: "DM Sans",
      fontWeight: "500", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "Muda: [EVENT_START_TIME] - [EVENT_END_TIME]",
      x: 50, y: 90, fontSize: 11, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
    {
      content: "Fika [EVENT_REPORTING_TIME] | Kiti: [GUEST_SEATNO]",
      x: 50, y: 95, fontSize: 10, color: "", fontFamily: "DM Sans",
      fontWeight: "400", textAlign: "center", letterSpacing: 0.5, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 85, visible: true,
    },
  ],
};

// ============================================================================
// BASE DESIGNS
// ============================================================================
const DESIGNS: Design[] = [
  {
    id: "swahili-wedding",
    name: "Harusi ya Kiszawahi",
    description: "Templeti ya harusi ya Kiswahili - tayari kutumia",
    background: "#1a1a2e",
    ink: "#f4e4bc",
    accent: "#d4af37",
    font: "Playfair Display",
    presetContent: SWAHILI_WEDDING_PRESET,
  },
  { id: "noir", name: "Midnight Gala", description: "Velvet navy, champagne type", background: "#111827", ink: "#fff8e7", accent: "#d6ad55", font: "Playfair Display" },
  { id: "garden", name: "Botanical Garden", description: "Fresh sage and soft ivory", background: "#e9f0e5", ink: "#20352b", accent: "#8b9c72", font: "Playfair Display" },
  { id: "rose", name: "Rosewater", description: "Romantic blush and rose ink", background: "#f4dfdf", ink: "#512f38", accent: "#b66c7b", font: "Great Vibes" },
  { id: "ivory", name: "Modern Ivory", description: "Quiet, editorial minimalism", background: "#f7f3ed", ink: "#25221f", accent: "#b88952", font: "DM Sans" },
];

const LAYER_LABELS: Record<Layer, string> = {
  title: "Event title", guest: "Guest name", date: "Date", venue: "Venue",
  qr: "QR code", icon: "Icon", frame: "Frame", polygon: "Polygon", custom: "Custom text",
};

const INITIAL_POSITIONS: Record<string, { x: number; y: number }> = {
  title: { x: 50, y: 15 }, guest: { x: 50, y: 37 }, date: { x: 50, y: 48 },
  venue: { x: 50, y: 56 }, qr: { x: 50, y: 73 }, icon: { x: 50, y: 50 },
  frame: { x: 50, y: 50 }, polygon: { x: 50, y: 50 },
};

const INITIAL_TEXT_CONFIG: Record<string, TextLayerConfig> = {
  title: { fontSize: 34, color: "", fontFamily: "Playfair Display", textAlign: "center", fontWeight: "600", letterSpacing: 0, lineHeight: 1.2 },
  guest: { fontSize: 58, color: "", fontFamily: "Great Vibes", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
  date: { fontSize: 16, color: "", fontFamily: "DM Sans", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
  venue: { fontSize: 15, color: "", fontFamily: "DM Sans", textAlign: "center", fontWeight: "400", letterSpacing: 0, lineHeight: 1.2 },
};

const ICONS = [
  { id: "star", name: "Star", svg: "★" }, { id: "heart", name: "Heart", svg: "♥" },
  { id: "diamond", name: "Diamond", svg: "♦" }, { id: "club", name: "Club", svg: "♣" },
  { id: "spade", name: "Spade", svg: "♠" }, { id: "crown", name: "Crown", svg: "👑" },
  { id: "flower", name: "Flower", svg: "❀" }, { id: "leaf", name: "Leaf", svg: "🍃" },
  { id: "music", name: "Music", svg: "♪" }, { id: "champagne", name: "Champagne", svg: "🥂" },
  { id: "ring", name: "Ring", svg: "💍" }, { id: "butterfly", name: "Butterfly", svg: "🦋" },
  { id: "snowflake", name: "Snowflake", svg: "❄" }, { id: "sun", name: "Sun", svg: "☀" },
  { id: "moon", name: "Moon", svg: "🌙" }, { id: "sparkle", name: "Sparkle", svg: "✨" },
];

// ============================================================================
// HELPER: Replace variables in text with preview values
// ============================================================================
function replaceVariables(text: string, previewData: Record<string, string>): string {
  let result = text;
  VARIABLES.forEach((v) => {
    const regex = new RegExp(`\\[${v.key}\\]`, "g");
    result = result.replace(regex, previewData[v.key] || v.example);
  });
  return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CardTemplatesPage() {
  const [design, setDesign] = useState<Design>(DESIGNS[0]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(INITIAL_POSITIONS);
  const [activeLayer, setActiveLayer] = useState<Layer>("title");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundFileId, setBackgroundFileId] = useState("");
  const [eventId, setEventId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null);
  const [draggingCustomId, setDraggingCustomId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [textConfigs, setTextConfigs] = useState<Record<string, TextLayerConfig>>(INITIAL_TEXT_CONFIG);

  // Custom text layers (NEW)
  const [customTexts, setCustomTexts] = useState<CustomTextLayer[]>([]);
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);

  // Variable menu
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [variableTargetId, setVariableTargetId] = useState<string | null>(null);
  const [variableTargetLayer, setVariableTargetLayer] = useState<keyof typeof INITIAL_TEXT_CONFIG | null>(null);

  // Other layers
  const [icons, setIcons] = useState<IconLayer[]>([]);
  const [frame, setFrame] = useState<FrameLayer>({ type: "none", x: 50, y: 50, width: 90, height: 90, color: "transparent", borderWidth: 2, borderColor: design.accent, rotation: 0 });
  const [polygons, setPolygons] = useState<PolygonLayer[]>([]);

  // UI state
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showIconLibrary, setShowIconLibrary] = useState(false);
  const [showFrameTools, setShowFrameTools] = useState(false);
  const [showPolygonTools, setShowPolygonTools] = useState(false);
  const [showCustomTextPanel, setShowCustomTextPanel] = useState(false);
  const [customText, setCustomText] = useState({ title: "", guest: "", date: "", venue: "" });

  // Preview data (for variable replacement)
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, string>>({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const previewData = useMemo(() => {
    const base: Record<string, string> = {};
    VARIABLES.forEach((v) => { base[v.key] = v.example; });
    return { ...base, ...previewOverrides };
  }, [previewOverrides]);

  // Queries
  const { data: events = [] } = useQuery({
    queryKey: ["card-events"],
    queryFn: async () => (await api.get("/events?per_page=100")).data.data ?? [],
  });
  const { data: savedDesigns = [] } = useQuery({
    queryKey: ["active-card-designs"],
    queryFn: async () => (await api.get("/cards/templates")).data.data ?? [],
  });
  const { data: guests = [] } = useQuery({
    queryKey: ["card-guests", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/guests?per_page=500`)).data.data ?? [],
    enabled: !!eventId,
  });

  const selectedEvent: any = events.find((item: any) => item.id === eventId);
  const selectedGuest: any = guests.find((item: any) => item.id === guestId);

  const { data: invitations = [] } = useQuery({
    queryKey: ["card-invitations", eventId],
    queryFn: async () => {
      const response = await api.get(`/events/${eventId}/invitations`);
      return response.data.data ?? [];
    },
    enabled: !!eventId,
  });

  const selectedInvitation: any = invitations.find((item: any) => item.guest_id === guestId);

  const { data: qrUrl } = useQuery({
    queryKey: ["card-qr", eventId, selectedInvitation?.id],
    queryFn: async () => {
      const response = await api.get(`/events/${eventId}/invitations/${selectedInvitation.id}/qr`, { responseType: "blob" });
      return URL.createObjectURL(response.data);
    },
    enabled: !!eventId && !!selectedInvitation?.id,
  });

  // Build preview data from real event/guest
  useEffect(() => {
    if (selectedEvent || selectedGuest) {
      const overrides: Record<string, string> = {};
      if (selectedEvent) {
        overrides.EVENT_TITLE = selectedEvent.title || "";
        overrides.EVENT_VENUE = selectedEvent.venue_name || "";
        overrides.EVENT_DATE = selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString("sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : "";
        overrides.EVENT_START_TIME = selectedEvent.event_time || "";
        overrides.EVENT_TYPE = selectedEvent.event_type || "Harusi";
        overrides.CHURCH = selectedEvent.church || "";
        overrides.EVENT_ORGANISATION_NAME = selectedEvent.organisation_name || "";
        overrides.EVENT_CHARACTER_NAME1 = selectedEvent.character_name_1 || "";
        overrides.EVENT_CHARACTER_NAME2 = selectedEvent.character_name_2 || "";
      }
      if (selectedGuest) {
        overrides.GUEST_NAME = selectedGuest.full_name || "";
        overrides.GUEST_SEATNO = selectedGuest.table_number || "";
        overrides.GUEST_CATEGORY = selectedGuest.guest_category || "";
      }
      setPreviewOverrides(overrides);
    }
  }, [selectedEvent, selectedGuest]);

  const galleryDesigns = useMemo<Design[]>(() => [
    ...DESIGNS,
    ...savedDesigns.map((template: any) => {
      const config = template.theme_config ?? {};
      return {
        id: `saved-${template.id}`, sourceId: template.id, name: template.name,
        description: template.description ?? "Published admin design",
        background: config.background_color ?? "#f7f3ed",
        ink: config.text_color ?? "#25221f",
        accent: config.accent_color ?? "#b88952",
        font: config.font_family ?? "Playfair Display",
        previewImage: template.preview_image_url ?? undefined,
      };
    }),
  ], [savedDesigns]);

  const values = useMemo(() => ({
    title: (customText.title || selectedEvent?.title) ?? "An Evening to Remember",
    guest: (customText.guest || selectedGuest?.full_name) ?? "Guest of Honour",
    date: customText.date || (selectedEvent?.event_date ? new Date(selectedEvent.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Saturday, 14 December 2026"),
    venue: (customText.venue || selectedEvent?.venue_name) ?? "The Royal Garden",
  }), [selectedEvent, selectedGuest, customText]);

  // ============================================================================
  // MUTATIONS
  // ============================================================================
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.type === "image/svg+xml") {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ data: { file_id: "svg-inline", svg_data: e.target?.result } });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      const form = new FormData();
      form.append("file", file);
      return api.post("/files/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (response: any, file) => {
      if (file.type === "image/svg+xml") {
        setBackgroundFileId("svg-inline");
        setBackgroundUrl(response.data.svg_data);
      } else {
        setBackgroundFileId(response.data.data.file_id);
        setBackgroundUrl(URL.createObjectURL(file));
      }
      toast.success("Background uploaded");
    },
    onError: () => toast.error("Background upload failed"),
  });

  const saveDesignMutation = useMutation({
    mutationFn: async (payload: any) => api.post("/cards/templates", payload),
    onSuccess: () => { toast.success("Design saved as template"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to save"),
  });

  const sendMutation = useMutation({
    mutationFn: (channel: string) => api.post(`/events/${eventId}/invitations/send`, { guest_ids: [guestId], channel }),
    onSuccess: () => toast.success("Card sent to guest"),
    onError: (error: any) => toast.error(error?.response?.data?.error?.message ?? "Could not send card"),
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const moveLayer = (layer: string, event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
    setPositions((current) => ({ ...current, [layer]: { x, y } }));
  };

  const moveCustomText = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
    setCustomTexts((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
  };

  const addCustomText = (initialContent: string = "New text box") => {
    const newLayer: CustomTextLayer = {
      id: `custom-${Date.now()}`,
      content: initialContent,
      x: 50, y: 50,
      fontSize: 16, color: design.ink, fontFamily: design.font,
      fontWeight: "400", textAlign: "center", letterSpacing: 0, lineHeight: 1.2,
      shape: "straight", arcRadius: 200, rotation: 0, maxWidth: 80, visible: true,
    };
    setCustomTexts([...customTexts, newLayer]);
    setActiveCustomId(newLayer.id);
    setActiveLayer("custom");
    setShowCustomTextPanel(true);
    toast.success("Text box added");
  };

  const updateCustomText = (id: string, updates: Partial<CustomTextLayer>) => {
    setCustomTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deleteCustomText = (id: string) => {
    setCustomTexts((prev) => prev.filter((t) => t.id !== id));
    if (activeCustomId === id) setActiveCustomId(null);
    toast.success("Text box deleted");
  };

  const duplicateCustomText = (id: string) => {
    const source = customTexts.find((t) => t.id === id);
    if (!source) return;
    const newLayer: CustomTextLayer = { ...source, id: `custom-${Date.now()}`, x: source.x + 3, y: source.y + 3 };
    setCustomTexts([...customTexts, newLayer]);
    setActiveCustomId(newLayer.id);
    toast.success("Text box duplicated");
  };

  const insertVariable = (variableKey: string) => {
    const varText = `[${variableKey}]`;
    if (variableTargetLayer && textConfigs[variableTargetLayer]) {
      const current = customText[variableTargetLayer as keyof typeof customText] || values[variableTargetLayer as keyof typeof values] || "";
      setCustomText((prev) => ({ ...prev, [variableTargetLayer]: current + " " + varText }));
    } else if (variableTargetId) {
      const target = customTexts.find((t) => t.id === variableTargetId);
      if (target) {
        updateCustomText(variableTargetId, { content: target.content + " " + varText });
      }
    }
    setShowVariableMenu(false);
    setVariableTargetId(null);
    setVariableTargetLayer(null);
    toast.success(`Variable [${variableKey}] inserted`);
  };

  const addIcon = (icon: string) => {
    const newIcon: IconLayer = { id: `icon-${Date.now()}`, icon, x: 50, y: 50, size: 48, color: design.accent, rotation: 0 };
    setIcons([...icons, newIcon]);
    setActiveLayer("icon");
    setShowIconLibrary(false);
    toast.success("Icon added");
  };

  const removeIcon = (id: string) => setIcons(icons.filter((icon) => icon.id !== id));
  const updateIcon = (id: string, updates: Partial<IconLayer>) => setIcons(icons.map((icon) => (icon.id === id ? { ...icon, ...updates } : icon)));
  const updateFrame = (updates: Partial<FrameLayer>) => setFrame((prev) => ({ ...prev, ...updates }));

  const addPolygon = (type: PolygonType) => {
    const newPolygon: PolygonLayer = {
      id: `polygon-${Date.now()}`, type, x: 50, y: 50, size: 60,
      color: design.accent + "40", borderColor: design.accent, borderWidth: 2, rotation: 0,
      sides: type === "triangle" ? 3 : type === "pentagon" ? 5 : type === "hexagon" ? 6 : 5,
    };
    setPolygons([...polygons, newPolygon]);
    setActiveLayer("polygon");
    setShowPolygonTools(false);
    toast.success("Polygon added");
  };

  const removePolygon = (id: string) => setPolygons(polygons.filter((p) => p.id !== id));
  const updatePolygon = (id: string, updates: Partial<PolygonLayer>) => setPolygons(polygons.map((p) => (p.id === id ? { ...p, ...updates } : p)));

  const updateTextConfig = (layer: string, updates: Partial<TextLayerConfig>) => {
    setTextConfigs((prev) => ({ ...prev, [layer]: { ...prev[layer], ...updates } }));
  };

  const getPolygonClipPath = (type: PolygonType): string => {
    switch (type) {
      case "triangle": return "polygon(50% 0%, 0% 100%, 100% 100%)";
      case "pentagon": return "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
      case "hexagon": return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
      case "star": return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
      default: return "none";
    }
  };

  const getPolygonPoints = (type: PolygonType, radius: number, sides?: number): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    const numSides = sides || (type === "triangle" ? 3 : type === "pentagon" ? 5 : type === "hexagon" ? 6 : 5);
    if (type === "star") {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.4;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
      }
    } else {
      for (let i = 0; i < numSides; i++) {
        const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
        points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      }
    }
    return points;
  };

  // ============================================================================
  // EXPORT FUNCTIONS
  // ============================================================================
  const drawCanvas = async (canvas: HTMLCanvasElement) => {
    const width = 900;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Background
    if (backgroundUrl) {
      if (backgroundFileId === "svg-inline" && backgroundUrl.startsWith("data:image/svg+xml")) {
        const svgData = backgroundUrl.split(",")[1];
        const svgBlob = new Blob([decodeURIComponent(svgData)], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const imgRatio = img.width / img.height;
            const canvasRatio = width / height;
            let drawWidth, drawHeight, drawX, drawY;
            if (imgRatio > canvasRatio) {
              drawWidth = width; drawHeight = width / imgRatio; drawX = 0; drawY = (height - drawHeight) / 2;
            } else {
              drawHeight = height; drawWidth = height * imgRatio; drawX = (width - drawWidth) / 2; drawY = 0;
            }
            context.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            context.fillStyle = "rgba(0,0,0,0.08)";
            context.fillRect(0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = reject;
          img.src = url;
        });
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            context.drawImage(img, 0, 0, width, height);
            context.fillStyle = "rgba(0,0,0,0.08)";
            context.fillRect(0, 0, width, height);
            resolve();
          };
          img.onerror = reject;
          img.src = backgroundUrl;
        });
      }
    } else {
      context.fillStyle = design.background;
      context.fillRect(0, 0, width, height);
    }

    // Frame
    if (frame.type !== "none") {
      context.save();
      const frameX = (frame.x / 100) * width;
      const frameY = (frame.y / 100) * height;
      const frameW = (frame.width / 100) * width;
      const frameH = (frame.height / 100) * height;
      context.translate(frameX, frameY);
      context.rotate((frame.rotation * Math.PI) / 180);
      if (frame.color && frame.color !== "transparent") {
        context.fillStyle = frame.color;
        if (frame.type === "ellipse") {
          context.beginPath();
          context.ellipse(0, 0, frameW / 2, frameH / 2, 0, 0, 2 * Math.PI);
          context.fill();
        } else if (frame.type === "rectangle") {
          context.fillRect(-frameW / 2, -frameH / 2, frameW, frameH);
        }
      }
      if (frame.borderWidth > 0) {
        context.strokeStyle = frame.borderColor;
        context.lineWidth = frame.borderWidth;
        if (frame.type === "ellipse") {
          context.beginPath();
          context.ellipse(0, 0, frameW / 2, frameH / 2, 0, 0, 2 * Math.PI);
          context.stroke();
        } else if (frame.type === "rectangle") {
          context.strokeRect(-frameW / 2, -frameH / 2, frameW, frameH);
        }
      }
      context.restore();
    }

    // Polygons
    polygons.forEach((polygon) => {
      context.save();
      const polyX = (polygon.x / 100) * width;
      const polyY = (polygon.y / 100) * height;
      context.translate(polyX, polyY);
      context.rotate((polygon.rotation * Math.PI) / 180);
      context.fillStyle = polygon.color;
      context.strokeStyle = polygon.borderColor;
      context.lineWidth = polygon.borderWidth;
      context.beginPath();
      const points = getPolygonPoints(polygon.type, polygon.size / 2, polygon.sides);
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
      context.closePath();
      context.fill();
      if (polygon.borderWidth > 0) context.stroke();
      context.restore();
    });

    // Icons
    icons.forEach((icon) => {
      context.save();
      const iconX = (icon.x / 100) * width;
      const iconY = (icon.y / 100) * height;
      context.translate(iconX, iconY);
      context.rotate((icon.rotation * Math.PI) / 180);
      context.fillStyle = icon.color;
      context.font = `${icon.size}px serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(icon.icon, 0, 0);
      context.restore();
    });

    // Fixed text layers
    const drawText = (text: string, layer: string) => {
      const config = textConfigs[layer];
      if (!config) return;
      const point = positions[layer];
      if (!point) return;
      const x = (point.x / 100) * width;
      const y = (point.y / 100) * height;
      const processedText = replaceVariables(text, previewData);
      context.font = `${config.fontWeight} ${config.fontSize}px "${config.fontFamily}"`;
      context.fillStyle = config.color || design.ink;
      context.textAlign = config.textAlign;
      let textX = x;
      if (config.textAlign === "left") textX = x - width / 2;
      else if (config.textAlign === "right") textX = x + width / 2;
      context.fillText(processedText, textX, y);
    };
    drawText(values.title, "title");
    drawText(values.guest, "guest");
    drawText(values.date, "date");
    drawText(values.venue, "venue");

    // Custom text layers (with curved text support)
    customTexts.forEach((ct) => {
      if (!ct.visible) return;
      const processedContent = replaceVariables(ct.content, previewData);
      const x = (ct.x / 100) * width;
      const y = (ct.y / 100) * height;

      context.save();
      context.translate(x, y);
      context.rotate((ct.rotation * Math.PI) / 180);
      context.font = `${ct.fontWeight} ${ct.fontSize}px "${ct.fontFamily}"`;
      context.fillStyle = ct.color || design.ink;
      context.textAlign = ct.textAlign;
      context.letterSpacing = `${ct.letterSpacing}px`;

      if (ct.shape === "straight") {
        // Word wrap for long text
        const maxWidthPx = (ct.maxWidth / 100) * width;
        const words = processedContent.split(" ");
        const lines: string[] = [];
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = context.measureText(testLine);
          if (metrics.width > maxWidthPx && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        let textX = 0;
        if (ct.textAlign === "left") textX = -maxWidthPx / 2;
        else if (ct.textAlign === "right") textX = maxWidthPx / 2;

        lines.forEach((line, idx) => {
          context.fillText(line, textX, idx * ct.fontSize * ct.lineHeight);
        });
      } else if (ct.shape === "arc-up" || ct.shape === "arc-down") {
        // Curved text along arc
        const radius = ct.arcRadius;
        const direction = ct.shape === "arc-up" ? -1 : 1;
        const chars = processedContent.split("");
        const totalAngle = chars.length * 0.08;
        let startAngle = -Math.PI / 2 - totalAngle / 2;

        chars.forEach((char, idx) => {
          const angle = startAngle + (idx * totalAngle) / (chars.length - 1 || 1);
          const charX = Math.cos(angle) * radius * direction;
          const charY = Math.sin(angle) * radius * direction;
          context.save();
          context.translate(charX, charY);
          context.rotate(angle + Math.PI / 2);
          context.fillText(char, 0, 0);
          context.restore();
        });
      } else if (ct.shape === "circle") {
        const radius = ct.arcRadius;
        const chars = processedContent.split("");
        const totalAngle = (chars.length * 0.1) % (Math.PI * 2);
        chars.forEach((char, idx) => {
          const angle = (idx / chars.length) * Math.PI * 2 - Math.PI / 2;
          const charX = Math.cos(angle) * radius;
          const charY = Math.sin(angle) * radius;
          context.save();
          context.translate(charX, charY);
          context.rotate(angle + Math.PI / 2);
          context.fillText(char, 0, 0);
          context.restore();
        });
      }
      context.restore();
    });

    // Border
    context.strokeStyle = design.accent;
    context.lineWidth = 4;
    context.strokeRect(55, 55, width - 110, height - 110);

    // QR label
    context.fillStyle = design.accent;
    context.font = "20px DM Sans";
    context.textAlign = "center";
    context.fillText("SCAN TO CHECK IN", width / 2, (positions.qr.y / 100) * height + 180);
  };

  const exportPng = async () => {
    const canvas = document.createElement("canvas");
    await drawCanvas(canvas);
    const link = document.createElement("a");
    link.download = `${design.name.toLowerCase().replaceAll(" ", "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("PNG downloaded");
  };

  const exportPdf = async () => {
    const canvas = document.createElement("canvas");
    await drawCanvas(canvas);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, 105, 148);
    pdf.save(`${design.name.toLowerCase().replaceAll(" ", "-")}.pdf`);
    toast.success("PDF downloaded");
  };

  const saveAsTemplate = () => {
    const payload = {
      name: `${design.name} - Custom`,
      description: "Custom design from Card Studio",
      theme_config: {
        background_color: design.background,
        text_color: design.ink,
        accent_color: design.accent,
        font_family: design.font,
        positions,
        text_configs: textConfigs,
        custom_texts: customTexts,  // ✅ Include custom text layers
        background_file_id: backgroundFileId || null,
      },
      background_file_id: backgroundFileId || null,
      preview_image_url: null,
    };
    saveDesignMutation.mutate(payload);
  };

  // ============================================================================
  // Apply preset when selecting a template with preset content
  // ============================================================================
  const applyDesign = (item: Design) => {
    setDesign(item);
    if (item.presetContent) {
      setPositions({ ...INITIAL_POSITIONS, ...item.presetContent.positions });
      setTextConfigs({ ...INITIAL_TEXT_CONFIG, ...item.presetContent.textConfigs });
      setCustomTexts(item.presetContent.customTexts.map((ct, idx) => ({ ...ct, id: `custom-${Date.now()}-${idx}` })));
    } else {
      setPositions(INITIAL_POSITIONS);
      setTextConfigs(INITIAL_TEXT_CONFIG);
      setCustomTexts([]);
    }
    setBackgroundUrl(null);
    setBackgroundFileId("");
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  const activeCustomText = customTexts.find((t) => t.id === activeCustomId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-700">
            <Sparkles className="h-4 w-4" /> Card Studio
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Make the first impression unforgettable.</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Choose a refined starting point, add unlimited text boxes with database variables,
            shape text in arcs or circles, then export or send a finished invitation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveAsTemplate} isLoading={saveDesignMutation.isPending}>
            <Copy className="h-4 w-4 mr-1" /> Save Template
          </Button>
          <Button variant="outline" onClick={exportPng}>
            <Download className="h-4 w-4" /> PNG
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[250px_minmax(420px,1fr)_320px]">
        {/* Template Gallery */}
        <Card title="Template gallery">
          <div className="space-y-3">
            {galleryDesigns.map((item) => (
              <button
                key={item.id}
                onClick={() => applyDesign(item)}
                className={`w-full overflow-hidden rounded-xl border text-left transition ${design.id === item.id ? "border-gold-500 ring-2 ring-gold-200" : "border-slate-200 hover:border-gold-300"
                  }`}
              >
                <div
                  className="h-28 bg-cover bg-center p-3"
                  style={{
                    background: item.background,
                    backgroundImage: item.previewImage ? `url(${item.previewImage})` : undefined,
                    color: item.ink,
                    fontFamily: item.font,
                  }}
                >
                  <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: item.accent }}>Royal Entry</p>
                  <p className="mt-5 text-lg">{item.name}</p>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                  {item.presetContent && (
                    <Badge label="Preset" variant="gold" className="mt-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Visual Editor Canvas */}
        <Card title="Visual editor" action={<span className="text-xs text-slate-400">Drag layers into place</span>}>
          <div
            ref={canvasRef}
            className="relative mx-auto aspect-[3/4] max-h-[720px] max-w-[540px] touch-none select-none overflow-hidden rounded-[2px] shadow-2xl"
            style={{
              backgroundColor: design.background,
              color: design.ink,
              backgroundImage: backgroundUrl
                ? `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)), url(${backgroundUrl})`
                : design.previewImage
                  ? `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)), url(${design.previewImage})`
                  : undefined,
              backgroundSize: backgroundFileId === "svg-inline" ? "contain" : "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              fontFamily: design.font,
            }}
            onClick={(event) => {
              if (draggingLayer) moveLayer(draggingLayer, event as unknown as React.PointerEvent<HTMLDivElement>);
              else if (draggingCustomId) moveCustomText(draggingCustomId, event as unknown as React.PointerEvent<HTMLDivElement>);
              else moveLayer(activeLayer === "custom" && activeCustomId ? activeCustomId : activeLayer, event as unknown as React.PointerEvent<HTMLDivElement>);
            }}
            onPointerMove={(event) => {
              if (draggingLayer) moveLayer(draggingLayer, event);
              else if (draggingCustomId) moveCustomText(draggingCustomId, event);
            }}
            onPointerUp={() => { setDraggingLayer(null); setDraggingCustomId(null); }}
            onPointerLeave={() => { setDraggingLayer(null); setDraggingCustomId(null); }}
          >
            {/* Frame */}
            {frame.type !== "none" && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${frame.x}%`, top: `${frame.y}%`,
                  width: `${frame.width}%`, height: `${frame.height}%`,
                  transform: `translate(-50%, -50%) rotate(${frame.rotation}deg)`,
                  border: `${frame.borderWidth}px solid ${frame.borderColor}`,
                  backgroundColor: frame.color,
                  borderRadius: frame.type === "ellipse" ? "50%" : frame.type === "flower" ? "30% 70% 70% 30% / 30% 30% 70% 70%" : "0",
                }}
              />
            )}

            {/* Polygons */}
            {polygons.map((polygon) => (
              <div
                key={polygon.id}
                className={`absolute cursor-grab ${activeLayer === "polygon" ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"}`}
                style={{
                  left: `${polygon.x}%`, top: `${polygon.y}%`,
                  width: `${polygon.size}px`, height: `${polygon.size}px`,
                  transform: `translate(-50%, -50%) rotate(${polygon.rotation}deg)`,
                  backgroundColor: polygon.color,
                  border: `${polygon.borderWidth}px solid ${polygon.borderColor}`,
                  clipPath: getPolygonClipPath(polygon.type),
                }}
                onPointerDown={(e) => { e.stopPropagation(); setActiveLayer("polygon"); setDraggingLayer("polygon"); }}
                onClick={(e) => { e.stopPropagation(); setActiveLayer("polygon"); }}
              >
                <button className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600" onClick={(e) => { e.stopPropagation(); removePolygon(polygon.id); }}>×</button>
              </div>
            ))}

            {/* Icons */}
            {icons.map((icon) => (
              <div
                key={icon.id}
                className={`absolute flex items-center justify-center cursor-grab ${activeLayer === "icon" ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"}`}
                style={{
                  left: `${icon.x}%`, top: `${icon.y}%`,
                  fontSize: `${icon.size}px`, color: icon.color,
                  transform: `translate(-50%, -50%) rotate(${icon.rotation}deg)`,
                }}
                onPointerDown={(e) => { e.stopPropagation(); setActiveLayer("icon"); setDraggingLayer("icon"); }}
                onClick={(e) => { e.stopPropagation(); setActiveLayer("icon"); }}
              >
                {icon.icon}
                <button className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600" onClick={(e) => { e.stopPropagation(); removeIcon(icon.id); }}>×</button>
              </div>
            ))}

            {/* Inner border */}
            <div className="pointer-events-none absolute inset-5 border" style={{ borderColor: design.accent }} />

            {/* Fixed text layers */}
            <LayerText layer="title" value={replaceVariables(values.title, previewData)} position={positions.title} active={activeLayer === "title"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} config={textConfigs.title} />
            <LayerText layer="guest" value={replaceVariables(values.guest, previewData)} position={positions.guest} active={activeLayer === "guest"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} config={textConfigs.guest} />
            <LayerText layer="date" value={replaceVariables(values.date, previewData)} position={positions.date} active={activeLayer === "date"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} config={textConfigs.date} />
            <LayerText layer="venue" value={replaceVariables(values.venue, previewData)} position={positions.venue} active={activeLayer === "venue"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} config={textConfigs.venue} />

            {/* Custom text layers */}
            {customTexts.map((ct) => (
              <CustomTextLayerView
                key={ct.id}
                layer={ct}
                active={activeCustomId === ct.id}
                previewData={previewData}
                defaultColor={design.ink}
                onSelect={() => { setActiveCustomId(ct.id); setActiveLayer("custom"); }}
                onDragStart={() => { setActiveCustomId(ct.id); setDraggingCustomId(ct.id); }}
                onEdit={() => setEditingCustomId(ct.id)}
                onDelete={() => deleteCustomText(ct.id)}
              />
            ))}

            {/* QR Code */}
            <div
              onPointerDown={(event) => { event.stopPropagation(); setActiveLayer("qr"); setDraggingLayer("qr"); }}
              onClick={(event) => { event.stopPropagation(); setActiveLayer("qr"); }}
              className={`absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center border-2 border-dashed bg-white/80 text-center text-[9px] font-bold text-slate-700 active:cursor-grabbing ${activeLayer === "qr" ? "ring-4 ring-gold-300" : ""}`}
              style={{ left: `${positions.qr.x}%`, top: `${positions.qr.y}%` }}
            >
              {qrUrl ? (
                <img src={qrUrl} alt="Invitation QR preview" className="h-full w-full object-contain p-1" />
              ) : (
                <span>
                  <span className="mb-1 block text-xl">▦</span>
                  {selectedInvitation ? "QR" : "Select guest"}
                </span>
              )}
            </div>

            <div className="absolute bottom-9 left-0 right-0 text-center text-[9px] uppercase tracking-[0.3em]" style={{ color: design.accent }}>
              Invitation · Check-in · Celebration
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <Move className="h-3.5 w-3.5" />
            Selected: <strong className="text-slate-700">
              {activeLayer === "custom" && activeCustomId
                ? `Custom text: ${customTexts.find((t) => t.id === activeCustomId)?.content.slice(0, 20) || "..."}`
                : LAYER_LABELS[activeLayer]}
            </strong>
            . Click anywhere to reposition it.
          </div>
        </Card>

        {/* Design Tools Panel */}
        <Card title="Design tools">
          <div className="space-y-4">
            {/* Tool toggles */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={showTextEditor ? "primary" : "outline"} size="sm" onClick={() => setShowTextEditor(!showTextEditor)}>
                <Type className="h-3.5 w-3.5" /> Text
              </Button>
              <Button variant={showCustomTextPanel ? "primary" : "outline"} size="sm" onClick={() => setShowCustomTextPanel(!showCustomTextPanel)}>
                <Layers className="h-3.5 w-3.5" /> Text Boxes
              </Button>
              <Button variant={showIconLibrary ? "primary" : "outline"} size="sm" onClick={() => setShowIconLibrary(!showIconLibrary)}>
                <Palette className="h-3.5 w-3.5" /> Icons
              </Button>
              <Button variant={showFrameTools ? "primary" : "outline"} size="sm" onClick={() => setShowFrameTools(!showFrameTools)}>
                <Square className="h-3.5 w-3.5" /> Frames
              </Button>
              <Button variant={showPolygonTools ? "primary" : "outline"} size="sm" onClick={() => setShowPolygonTools(!showPolygonTools)}>
                <Hexagon className="h-3.5 w-3.5" /> Polygons
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPreviewModal(true)}>
                <Variable className="h-3.5 w-3.5" /> Preview Data
              </Button>
            </div>

            {/* Fixed Text Editor */}
            {showTextEditor && activeLayer !== "qr" && activeLayer !== "icon" && activeLayer !== "frame" && activeLayer !== "polygon" && activeLayer !== "custom" && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-600">Edit {LAYER_LABELS[activeLayer as keyof typeof LAYER_LABELS]}</p>
                <div className="relative">
                  <input
                    type="text"
                    value={customText[activeLayer as keyof typeof customText] || values[activeLayer as keyof typeof values]}
                    onChange={(e) => setCustomText((prev) => ({ ...prev, [activeLayer]: e.target.value }))}
                    className="w-full rounded border border-slate-200 px-2 py-1 pr-8 text-sm"
                    placeholder="Custom text"
                  />
                  <button
                    type="button"
                    onClick={() => { setVariableTargetLayer(activeLayer as any); setVariableTargetId(null); setShowVariableMenu(true); }}
                    className="absolute right-1 top-1 rounded bg-gold-100 p-1 text-gold-700 hover:bg-gold-200"
                    title="Insert variable"
                  >
                    <Variable className="h-3 w-3" />
                  </button>
                </div>
                <TextConfigEditor
                  config={textConfigs[activeLayer]}
                  onChange={(updates) => updateTextConfig(activeLayer, updates)}
                  designInk={design.ink}
                  designFont={design.font}
                />
              </div>
            )}

            {/* Custom Text Boxes Panel */}
            {showCustomTextPanel && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Custom Text Boxes ({customTexts.length})</p>
                  <Button size="sm" variant="outline" onClick={() => addCustomText()}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>

                {/* Quick add presets */}
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => addCustomText("[GUEST_NAME]")} className="rounded border border-slate-200 px-2 py-1 text-[10px] hover:bg-gold-50">+ Guest Name</button>
                  <button onClick={() => addCustomText("[EVENT_DATE]")} className="rounded border border-slate-200 px-2 py-1 text-[10px] hover:bg-gold-50">+ Event Date</button>
                  <button onClick={() => addCustomText("[EVENT_VENUE]")} className="rounded border border-slate-200 px-2 py-1 text-[10px] hover:bg-gold-50">+ Venue</button>
                  <button onClick={() => addCustomText("[GUEST_SEATNO]")} className="rounded border border-slate-200 px-2 py-1 text-[10px] hover:bg-gold-50">+ Seat No</button>
                </div>

                {customTexts.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {customTexts.map((ct) => (
                      <div
                        key={ct.id}
                        className={`rounded border p-2 text-xs ${activeCustomId === ct.id ? "border-gold-500 bg-gold-50" : "border-slate-200"}`}
                        onClick={() => { setActiveCustomId(ct.id); setActiveLayer("custom"); }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 truncate font-medium text-slate-800">{ct.content}</p>
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setEditingCustomId(ct.id); }} className="rounded p-1 hover:bg-slate-100" title="Edit">
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); duplicateCustomText(ct.id); }} className="rounded p-1 hover:bg-slate-100" title="Duplicate">
                              <Copy className="h-3 w-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteCustomText(ct.id); }} className="rounded p-1 text-rose-600 hover:bg-rose-50" title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span>Shape: {ct.shape}</span>
                          <span>·</span>
                          <span>{ct.fontSize}px</span>
                          <span>·</span>
                          <span>{ct.fontFamily}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active custom text editor */}
                {activeCustomText && (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                    <p className="text-[10px] font-semibold text-slate-600">Edit: {activeCustomText.content.slice(0, 30)}</p>
                    <div className="relative">
                      <textarea
                        value={activeCustomText.content}
                        onChange={(e) => updateCustomText(activeCustomText.id, { content: e.target.value })}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        rows={2}
                      />
                      <button
                        type="button"
                        onClick={() => { setVariableTargetId(activeCustomText.id); setVariableTargetLayer(null); setShowVariableMenu(true); }}
                        className="absolute right-1 top-1 rounded bg-gold-100 p-1 text-gold-700 hover:bg-gold-200"
                        title="Insert variable"
                      >
                        <Variable className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Text shape selector */}
                    <div>
                      <label className="mb-1 block text-[10px] text-slate-500">Text Shape</label>
                      <div className="grid grid-cols-5 gap-1">
                        {(["straight", "arc-up", "arc-down", "circle", "wave"] as TextShape[]).map((shape) => (
                          <button
                            key={shape}
                            onClick={() => updateCustomText(activeCustomText.id, { shape })}
                            className={`rounded border px-1 py-1 text-[9px] ${activeCustomText.shape === shape ? "border-gold-500 bg-gold-50 text-gold-700" : "border-slate-200 hover:border-gold-300"}`}
                          >
                            {shape === "straight" ? "—" : shape === "arc-up" ? "⌒" : shape === "arc-down" ? "⌢" : shape === "circle" ? "○" : "〰"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(activeCustomText.shape === "arc-up" || activeCustomText.shape === "arc-down" || activeCustomText.shape === "circle") && (
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-500">Arc Radius: {activeCustomText.arcRadius}</label>
                        <input
                          type="range"
                          min="50"
                          max="400"
                          value={activeCustomText.arcRadius}
                          onChange={(e) => updateCustomText(activeCustomText.id, { arcRadius: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    )}

                    <TextConfigEditor
                      config={{
                        fontSize: activeCustomText.fontSize,
                        color: activeCustomText.color,
                        fontFamily: activeCustomText.fontFamily,
                        textAlign: activeCustomText.textAlign,
                        fontWeight: activeCustomText.fontWeight,
                        letterSpacing: activeCustomText.letterSpacing,
                        lineHeight: activeCustomText.lineHeight,
                      }}
                      onChange={(updates) => updateCustomText(activeCustomText.id, updates as Partial<CustomTextLayer>)}
                      designInk={design.ink}
                      designFont={design.font}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-500">Rotation: {activeCustomText.rotation}°</label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={activeCustomText.rotation}
                          onChange={(e) => updateCustomText(activeCustomText.id, { rotation: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-500">Max Width: {activeCustomText.maxWidth}%</label>
                        <input
                          type="range"
                          min="20"
                          max="100"
                          value={activeCustomText.maxWidth}
                          onChange={(e) => updateCustomText(activeCustomText.id, { maxWidth: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-[10px]">
                      <input
                        type="checkbox"
                        checked={activeCustomText.visible}
                        onChange={(e) => updateCustomText(activeCustomText.id, { visible: e.target.checked })}
                        className="h-3 w-3"
                      />
                      Visible
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Icon Library */}
            {showIconLibrary && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-600">Add icons</p>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {ICONS.map((icon) => (
                    <button
                      key={icon.id}
                      onClick={() => addIcon(icon.svg)}
                      className="flex aspect-square items-center justify-center rounded border border-slate-200 text-2xl hover:border-gold-400 hover:bg-gold-50 transition"
                      title={icon.name}
                    >
                      {icon.svg}
                    </button>
                  ))}
                </div>
                {icons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500">Active icons ({icons.length})</p>
                    {icons.map((icon) => (
                      <div key={icon.id} className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="text-xl">{icon.icon}</span>
                        <input type="number" value={icon.size} onChange={(e) => updateIcon(icon.id, { size: parseInt(e.target.value) })} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs" title="Size" />
                        <input type="color" value={icon.color} onChange={(e) => updateIcon(icon.id, { color: e.target.value })} className="h-6 w-8 rounded border border-slate-200" title="Color" />
                        <input type="number" value={icon.rotation} onChange={(e) => updateIcon(icon.id, { rotation: parseInt(e.target.value) })} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs" title="Rotation" />
                        <Button variant="ghost" size="sm" onClick={() => removeIcon(icon.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Frame Tools */}
            {showFrameTools && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-600">Frame style</p>
                <div className="grid grid-cols-4 gap-2">
                  <Button variant={frame.type === "none" ? "primary" : "outline"} size="sm" onClick={() => updateFrame({ type: "none" })}>None</Button>
                  <Button variant={frame.type === "rectangle" ? "primary" : "outline"} size="sm" onClick={() => updateFrame({ type: "rectangle" })}><Square className="h-3 w-3" /></Button>
                  <Button variant={frame.type === "ellipse" ? "primary" : "outline"} size="sm" onClick={() => updateFrame({ type: "ellipse" })}><Circle className="h-3 w-3" /></Button>
                  <Button variant={frame.type === "flower" ? "primary" : "outline"} size="sm" onClick={() => updateFrame({ type: "flower" })}>❀</Button>
                </div>
                {frame.type !== "none" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-500">Border width</label>
                        <input type="number" value={frame.borderWidth} onChange={(e) => updateFrame({ borderWidth: parseInt(e.target.value) })} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-500">Rotation</label>
                        <input type="number" value={frame.rotation} onChange={(e) => updateFrame({ rotation: parseInt(e.target.value) })} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] text-slate-500">Border color</label>
                      <input type="color" value={frame.borderColor} onChange={(e) => updateFrame({ borderColor: e.target.value })} className="w-full h-8 rounded border border-slate-200" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] text-slate-500">Background color</label>
                      <input type="color" value={frame.color === "transparent" ? "#ffffff" : frame.color} onChange={(e) => updateFrame({ color: e.target.value })} className="w-full h-8 rounded border border-slate-200" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Polygon Tools */}
            {showPolygonTools && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-600">Add polygons</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => addPolygon("triangle")}><Hexagon className="h-3 w-3 mr-1" /> Triangle</Button>
                  <Button variant="outline" size="sm" onClick={() => addPolygon("pentagon")}><Hexagon className="h-3 w-3 mr-1" /> Pentagon</Button>
                  <Button variant="outline" size="sm" onClick={() => addPolygon("hexagon")}><Hexagon className="h-3 w-3 mr-1" /> Hexagon</Button>
                  <Button variant="outline" size="sm" onClick={() => addPolygon("star")}><Sparkles className="h-3 w-3 mr-1" /> Star</Button>
                </div>
                {polygons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500">Active polygons ({polygons.length})</p>
                    {polygons.map((polygon) => (
                      <div key={polygon.id} className="flex items-center gap-2 rounded border border-slate-200 p-2">
                        <span className="text-xs w-16">{polygon.type}</span>
                        <input type="number" value={polygon.size} onChange={(e) => updatePolygon(polygon.id, { size: parseInt(e.target.value) })} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs" />
                        <input type="color" value={polygon.color} onChange={(e) => updatePolygon(polygon.id, { color: e.target.value })} className="h-6 w-8 rounded border border-slate-200" />
                        <input type="color" value={polygon.borderColor} onChange={(e) => updatePolygon(polygon.id, { borderColor: e.target.value })} className="h-6 w-8 rounded border border-slate-200" />
                        <input type="number" value={polygon.rotation} onChange={(e) => updatePolygon(polygon.id, { rotation: parseInt(e.target.value) })} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs" />
                        <Button variant="ghost" size="sm" onClick={() => removePolygon(polygon.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Background image */}
            <div className="border-t border-slate-100 pt-3">
              <label className="mb-2 block text-xs font-semibold text-slate-600">Background image</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 p-4 text-sm font-semibold text-gold-800 hover:bg-gold-100">
                <ImagePlus className="h-4 w-4" /> {uploadMutation.isPending ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/svg+xml" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); }} />
              </label>
              {backgroundFileId && <p className="mt-2 truncate text-[10px] text-slate-400">Asset: {backgroundFileId}</p>}
            </div>

            {/* Preview data */}
            <div className="border-t border-slate-100 pt-3">
              <label className="mb-2 block text-xs font-semibold text-slate-600">Preview data</label>
              <Select value={eventId} onChange={(event) => { setEventId(event.target.value); setGuestId(""); }}>
                <option value="">Sample event</option>
                {events.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </Select>
              {eventId && (
                <Select label="Guest" value={guestId} onChange={(event) => setGuestId(event.target.value)}>
                  <option value="">Choose guest</option>
                  {guests.map((item: any) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                </Select>
              )}
            </div>

            {/* Send directly */}
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Send directly</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("whatsapp")}><Send className="h-3.5 w-3.5" /> WhatsApp</Button>
                <Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("email")}><Mail className="h-3.5 w-3.5" /> Email</Button>
                <Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("sms")}><Smartphone className="h-3.5 w-3.5" /> SMS</Button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Select an event and guest to activate delivery.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Variable Insertion Modal */}
      <Modal isOpen={showVariableMenu} onClose={() => setShowVariableMenu(false)} title="Insert Database Variable" size="md">
        <div className="space-y-3">
          <p className="text-xs text-slate-600">Click a variable to insert it at the cursor position. Variables are replaced with real data when the card is sent.</p>
          {["Mgeni", "Sherehe", "Mfumo"].map((category) => (
            <div key={category}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{category}</p>
              <div className="grid grid-cols-2 gap-1">
                {VARIABLES.filter((v) => v.category === category).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="rounded border border-slate-200 px-2 py-1.5 text-left text-xs hover:border-gold-400 hover:bg-gold-50"
                  >
                    <p className="font-mono font-semibold text-gold-700">[{v.key}]</p>
                    <p className="text-[10px] text-slate-500">{v.label}</p>
                    <p className="text-[10px] text-slate-400 italic">{v.example}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Preview Data Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} title="Preview Variable Values" size="md">
        <div className="space-y-3">
          <p className="text-xs text-slate-600">Override variable values to preview how the card will look with different data.</p>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {VARIABLES.map((v) => (
              <div key={v.key}>
                <label className="mb-1 block text-[10px] font-semibold text-slate-600">{v.label}</label>
                <input
                  type="text"
                  value={previewOverrides[v.key] || v.example}
                  onChange={(e) => setPreviewOverrides((prev) => ({ ...prev, [v.key]: e.target.value }))}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPreviewOverrides({})}>Reset to defaults</Button>
        </div>
      </Modal>

      {/* Edit Custom Text Modal (for larger editing) */}
      <Modal isOpen={!!editingCustomId} onClose={() => setEditingCustomId(null)} title="Edit Text Box" size="md">
        {(() => {
          const ct = customTexts.find((t) => t.id === editingCustomId);
          if (!ct) return null;
          return (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Content</label>
                <textarea
                  value={ct.content}
                  onChange={(e) => updateCustomText(ct.id, { content: e.target.value })}
                  rows={4}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { setVariableTargetId(ct.id); setVariableTargetLayer(null); setShowVariableMenu(true); setEditingCustomId(null); }}
                  className="mt-1 text-xs font-semibold text-gold-700 hover:underline"
                >
                  + Insert database variable
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingCustomId(null)}>Close</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Fixed text layer (existing)
function LayerText({ layer, value, position, active, onSelect, onDragStart, config }: {
  layer: string; value: string; position: { x: number; y: number }; active: boolean;
  onSelect: (layer: any) => void; onDragStart: (layer: any) => void; config: TextLayerConfig;
}) {
  const alignmentClass = config.textAlign === "left" ? "text-left" : config.textAlign === "right" ? "text-right" : "text-center";
  const customColor = config.color || "inherit";
  return (
    <button
      type="button"
      onPointerDown={(event) => { event.stopPropagation(); onSelect(layer); onDragStart(layer); }}
      onClick={(event) => { event.stopPropagation(); onSelect(layer); }}
      className={`absolute cursor-grab whitespace-nowrap px-2 py-1 transition active:cursor-grabbing ${active ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"} ${alignmentClass}`}
      style={{
        left: `${position.x}%`, top: `${position.y}%`,
        color: customColor, fontSize: `${config.fontSize}px`,
        fontFamily: config.fontFamily, fontWeight: config.fontWeight,
        letterSpacing: `${config.letterSpacing}px`, lineHeight: config.lineHeight,
        transform: "translate(-50%, -50%)",
      }}
    >
      {value}
    </button>
  );
}

// Custom text layer with shape support
function CustomTextLayerView({ layer, active, previewData, defaultColor, onSelect, onDragStart, onEdit, onDelete }: {
  layer: CustomTextLayer; active: boolean; previewData: Record<string, string>; defaultColor: string;
  onSelect: () => void; onDragStart: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const processedContent = replaceVariables(layer.content, previewData);
  const color = layer.color || defaultColor;

  if (layer.shape === "arc-up" || layer.shape === "arc-down" || layer.shape === "circle") {
    // SVG-based curved text rendering
    const radius = layer.arcRadius * 0.5;
    const svgSize = radius * 2 + layer.fontSize * 2;
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;

    let pathId = `path-${layer.id}`;
    let pathD: string;
    if (layer.shape === "arc-up") {
      pathD = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;
    } else if (layer.shape === "arc-down") {
      pathD = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 0 ${centerX + radius} ${centerY}`;
    } else {
      pathD = `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX - 0.01} ${centerY - radius}`;
    }

    return (
      <div
        className={`absolute cursor-grab ${active ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"}`}
        style={{
          left: `${layer.x}%`, top: `${layer.y}%`,
          transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
          width: `${svgSize}px`, height: `${svgSize}px`,
        }}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(); }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <svg width={svgSize} height={svgSize} className="overflow-visible">
          <defs>
            <path id={pathId} d={pathD} fill="none" />
          </defs>
          <text
            fill={color}
            style={{
              fontSize: `${layer.fontSize}px`,
              fontFamily: layer.fontFamily,
              fontWeight: layer.fontWeight,
              letterSpacing: `${layer.letterSpacing}px`,
            }}
            textAnchor="middle"
          >
            <textPath href={`#${pathId}`} startOffset="50%">
              {processedContent}
            </textPath>
          </text>
        </svg>
        {active && (
          <>
            <button className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 z-10" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
            <button className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-gold-500 text-white text-xs hover:bg-gold-600 z-10" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
          </>
        )}
      </div>
    );
  }

  // Straight text
  return (
    <div
      className={`absolute cursor-grab ${active ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"}`}
      style={{
        left: `${layer.x}%`, top: `${layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        maxWidth: `${layer.maxWidth}%`,
        color, fontSize: `${layer.fontSize}px`,
        fontFamily: layer.fontFamily, fontWeight: layer.fontWeight,
        letterSpacing: `${layer.letterSpacing}px`, lineHeight: layer.lineHeight,
        textAlign: layer.textAlign,
        wordWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(); }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(); }}
    >
      {processedContent}
      {active && (
        <>
          <button className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 z-10" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
          <button className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-gold-500 text-white text-xs hover:bg-gold-600 z-10" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
        </>
      )}
    </div>
  );
}

// Shared text config editor
function TextConfigEditor({ config, onChange, designInk, designFont }: {
  config: TextLayerConfig; onChange: (updates: Partial<TextLayerConfig>) => void;
  designInk: string; designFont: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">Size</label>
          <input type="number" value={config.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">Color</label>
          <input type="color" value={config.color || designInk} onChange={(e) => onChange({ color: e.target.value })} className="w-full h-8 rounded border border-slate-200" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] text-slate-500">Font</label>
        <Select value={config.fontFamily || designFont} onChange={(e) => onChange({ fontFamily: e.target.value })}>
          <option>Playfair Display</option>
          <option>Great Vibes</option>
          <option>DM Sans</option>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] text-slate-500">Alignment</label>
        <div className="flex gap-1">
          <Button variant={config.textAlign === "left" ? "primary" : "outline"} size="sm" onClick={() => onChange({ textAlign: "left" })}><AlignLeft className="h-3 w-3" /></Button>
          <Button variant={config.textAlign === "center" ? "primary" : "outline"} size="sm" onClick={() => onChange({ textAlign: "center" })}><AlignCenter className="h-3 w-3" /></Button>
          <Button variant={config.textAlign === "right" ? "primary" : "outline"} size="sm" onClick={() => onChange({ textAlign: "right" })}><AlignRight className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">Weight</label>
          <Select value={config.fontWeight || "400"} onChange={(e) => onChange({ fontWeight: e.target.value })}>
            <option value="300">Light</option>
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semi-bold</option>
            <option value="700">Bold</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">Spacing</label>
          <input type="number" step="0.1" value={config.letterSpacing} onChange={(e) => onChange({ letterSpacing: parseFloat(e.target.value) })} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
        </div>
      </div>
    </>
  );
}