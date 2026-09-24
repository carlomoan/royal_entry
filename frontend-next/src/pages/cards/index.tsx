"use client";
import "@fontsource/playfair-display/600.css";
import "@fontsource/great-vibes/400.css";
import "@fontsource/dm-sans/400.css";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileImage, FileText, ImagePlus, Mail, Move, Palette, Send, Smartphone, Sparkles, Upload } from "lucide-react";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Badge, Button, Card, Select } from "@/components/ui";

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
};

type Layer = "title" | "guest" | "date" | "venue" | "qr";

const DESIGNS: Design[] = [
  { id: "noir", name: "Midnight Gala", description: "Velvet navy, champagne type", background: "#111827", ink: "#fff8e7", accent: "#d6ad55", font: "Playfair Display" },
  { id: "garden", name: "Botanical Garden", description: "Fresh sage and soft ivory", background: "#e9f0e5", ink: "#20352b", accent: "#8b9c72", font: "Playfair Display" },
  { id: "rose", name: "Rosewater", description: "Romantic blush and rose ink", background: "#f4dfdf", ink: "#512f38", accent: "#b66c7b", font: "Great Vibes" },
  { id: "ivory", name: "Modern Ivory", description: "Quiet, editorial minimalism", background: "#f7f3ed", ink: "#25221f", accent: "#b88952", font: "DM Sans" },
];

const LAYER_LABELS: Record<Layer, string> = { title: "Event title", guest: "Guest name", date: "Date", venue: "Venue", qr: "QR code" };
const INITIAL_POSITIONS: Record<Layer, { x: number; y: number }> = {
  title: { x: 50, y: 15 }, guest: { x: 50, y: 37 }, date: { x: 50, y: 48 }, venue: { x: 50, y: 56 }, qr: { x: 50, y: 73 },
};

export default function CardTemplatesPage() {
  const [design, setDesign] = useState(DESIGNS[0]);
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [activeLayer, setActiveLayer] = useState<Layer>("title");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundFileId, setBackgroundFileId] = useState("");
  const [eventId, setEventId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [draggingLayer, setDraggingLayer] = useState<Layer | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
    queryFn: async () => (await api.get(`/events/${eventId}/invitations`)).data.data ?? [],
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
  const galleryDesigns = useMemo<Design[]>(() => [
    ...DESIGNS,
    ...savedDesigns.map((template: any) => {
      const config = template.theme_config ?? {};
      return { id: `saved-${template.id}`, sourceId: template.id, name: template.name, description: template.description ?? "Published admin design", background: config.background_color ?? "#f7f3ed", ink: config.text_color ?? "#25221f", accent: config.accent_color ?? "#b88952", font: config.font_family ?? "Playfair Display", previewImage: template.preview_image_url ?? undefined };
    }),
  ], [savedDesigns]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/files/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (response, file) => {
      setBackgroundFileId(response.data.data.file_id);
      setBackgroundUrl(URL.createObjectURL(file));
      toast.success("Background uploaded");
    },
    onError: () => toast.error("Background upload failed"),
  });
  const sendMutation = useMutation({
    mutationFn: (channel: string) => api.post(`/events/${eventId}/invitations/send`, { guest_ids: [guestId], channel }),
    onSuccess: () => toast.success("Card sent to guest"),
    onError: (error: any) => toast.error(error?.response?.data?.error?.message ?? "Could not send card"),
  });

  const values = useMemo(() => ({
    title: selectedEvent?.title ?? "An Evening to Remember",
    guest: selectedGuest?.full_name ?? "Guest of Honour",
    date: selectedEvent?.event_date ? new Date(selectedEvent.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Saturday, 14 December 2026",
    venue: selectedEvent?.venue_name ?? "The Royal Garden",
  }), [selectedEvent, selectedGuest]);

  const moveLayer = (layer: Layer, event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPositions((current) => ({ ...current, [layer]: { x: Math.round(((event.clientX - bounds.left) / bounds.width) * 100), y: Math.round(((event.clientY - bounds.top) / bounds.height) * 100) } }));
  };

  const exportPng = async () => {
    const node = canvasRef.current;
    if (!node) return;
    const width = 900;
    const height = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = design.background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = design.ink;
    context.textAlign = "center";
    const draw = (text: string, layer: Layer, size: number, family = design.font) => {
      const point = positions[layer];
      context.font = `${size}px "${family}"`;
      context.fillText(text, (point.x / 100) * width, (point.y / 100) * height);
    };
    draw(values.title, "title", 48);
    draw(values.guest, "guest", 70, "Great Vibes");
    draw(values.date, "date", 25);
    draw(values.venue, "venue", 22);
    context.strokeStyle = design.accent;
    context.lineWidth = 4;
    context.strokeRect(55, 55, width - 110, height - 110);
    context.fillStyle = design.accent;
    context.font = "20px DM Sans";
    context.fillText("SCAN TO CHECK IN", width / 2, (positions.qr.y / 100) * height + 180);
    const link = document.createElement("a");
    link.download = `${design.name.toLowerCase().replaceAll(" ", "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("PNG downloaded");
  };

  const exportPdf = async () => {
    const node = canvasRef.current;
    if (!node) return;
    await exportPng();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
    pdf.setFillColor(design.background);
    pdf.rect(0, 0, 105, 148, "F");
    pdf.setTextColor(design.ink);
    pdf.setFont("times", "bold");
    pdf.setFontSize(20);
    pdf.text(values.title, 52.5, 32, { align: "center" });
    pdf.setFont("times", "italic");
    pdf.setFontSize(25);
    pdf.text(values.guest, 52.5, 66, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(values.date, 52.5, 82, { align: "center" });
    pdf.text(values.venue, 52.5, 90, { align: "center" });
    pdf.setDrawColor(design.accent);
    pdf.rect(8, 8, 89, 132);
    pdf.save(`${design.name.toLowerCase().replaceAll(" ", "-")}.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-700"><Sparkles className="h-4 w-4" /> Card Studio</div>
          <h1 className="text-3xl font-bold text-slate-900">Make the first impression unforgettable.</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Choose a refined starting point, place every detail visually, then export or send a finished invitation.</p>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportPng}><Download className="h-4 w-4" /> PNG</Button><Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4" /> PDF</Button></div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[250px_minmax(420px,1fr)_300px]">
        <Card title="Template gallery">
          <div className="space-y-3">
            {galleryDesigns.map((item) => <button key={item.id} onClick={() => { setDesign(item); setPositions(INITIAL_POSITIONS); }} className={`w-full overflow-hidden rounded-xl border text-left transition ${design.id === item.id ? "border-gold-500 ring-2 ring-gold-200" : "border-slate-200 hover:border-gold-300"}`}>
              <div className="h-28 bg-cover bg-center p-3" style={{ background: item.background, backgroundImage: item.previewImage ? `url(${item.previewImage})` : undefined, color: item.ink, fontFamily: item.font }}><p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: item.accent }}>Royal Entry</p><p className="mt-5 text-lg">{item.name}</p></div>
              <div className="p-3"><p className="text-sm font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{item.description}</p></div>
            </button>)}
          </div>
        </Card>

        <Card title="Visual editor" action={<span className="text-xs text-slate-400">Drag layers into place</span>}>
          <div ref={canvasRef} className="relative mx-auto aspect-[3/4] max-h-[720px] max-w-[540px] touch-none select-none overflow-hidden rounded-[2px] shadow-2xl" style={{ background: design.background, color: design.ink, backgroundImage: backgroundUrl ? `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)), url(${backgroundUrl})` : design.previewImage ? `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)), url(${design.previewImage})` : undefined, backgroundSize: "cover", fontFamily: design.font }} onClick={(event) => moveLayer(activeLayer, event as unknown as React.PointerEvent<HTMLDivElement>)} onPointerMove={(event) => draggingLayer && moveLayer(draggingLayer, event)} onPointerUp={() => setDraggingLayer(null)} onPointerLeave={() => setDraggingLayer(null)}>
            <div className="pointer-events-none absolute inset-5 border" style={{ borderColor: design.accent }} />
            <LayerText layer="title" value={values.title} position={positions.title} active={activeLayer === "title"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} style={{ fontFamily: design.font, fontSize: "clamp(18px, 4vw, 34px)" }} />
            <LayerText layer="guest" value={values.guest} position={positions.guest} active={activeLayer === "guest"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} style={{ fontFamily: "Great Vibes", fontSize: "clamp(28px, 7vw, 58px)" }} />
            <LayerText layer="date" value={values.date} position={positions.date} active={activeLayer === "date"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} style={{ fontFamily: "DM Sans", fontSize: "clamp(10px, 2vw, 16px)" }} />
            <LayerText layer="venue" value={values.venue} position={positions.venue} active={activeLayer === "venue"} onSelect={setActiveLayer} onDragStart={setDraggingLayer} style={{ fontFamily: "DM Sans", fontSize: "clamp(10px, 2vw, 15px)" }} />
            <div onPointerDown={(event) => { event.stopPropagation(); setActiveLayer("qr"); setDraggingLayer("qr"); }} onClick={(event) => { event.stopPropagation(); setActiveLayer("qr"); }} className={`absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center border-2 border-dashed bg-white/80 text-center text-[9px] font-bold text-slate-700 active:cursor-grabbing ${activeLayer === "qr" ? "ring-4 ring-gold-300" : ""}`} style={{ left: `${positions.qr.x}%`, top: `${positions.qr.y}%` }}>{qrUrl ? <img src={qrUrl} alt="Invitation QR preview" className="h-full w-full object-contain p-1" /> : <span><span className="mb-1 block text-xl">▦</span>{selectedInvitation ? "QR" : "Select guest"}</span>}</div>
            <div className="absolute bottom-9 left-0 right-0 text-center text-[9px] uppercase tracking-[0.3em]" style={{ color: design.accent }}>Invitation · Check-in · Celebration</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500"><Move className="h-3.5 w-3.5" /> Selected: <strong className="text-slate-700">{LAYER_LABELS[activeLayer]}</strong>. Click anywhere to reposition it.</div>
        </Card>

        <Card title="Finish your card">
          <div className="space-y-5">
            <div><label className="mb-2 block text-xs font-semibold text-slate-600">Background image</label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 p-4 text-sm font-semibold text-gold-800 hover:bg-gold-100"><ImagePlus className="h-4 w-4" /> {uploadMutation.isPending ? "Uploading…" : "Upload image"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); }} /></label>{backgroundFileId && <p className="mt-2 truncate text-[10px] text-slate-400">Asset: {backgroundFileId}</p>}</div>
            <div><label className="mb-2 block text-xs font-semibold text-slate-600">Typeface</label><Select value={design.font} onChange={(event) => setDesign((current) => ({ ...current, font: event.target.value }))}><option>Playfair Display</option><option>Great Vibes</option><option>DM Sans</option></Select></div>
            <div><label className="mb-2 block text-xs font-semibold text-slate-600">Preview data</label><Select value={eventId} onChange={(event) => { setEventId(event.target.value); setGuestId(""); }}><option value="">Sample event</option>{events.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>{eventId && <Select label="Guest" value={guestId} onChange={(event) => setGuestId(event.target.value)}><option value="">Choose guest</option>{guests.map((item: any) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select>}</div>
            <div className="border-t border-slate-100 pt-4"><p className="mb-2 text-xs font-semibold text-slate-600">Send directly</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("whatsapp")}><Send className="h-3.5 w-3.5" /> WhatsApp</Button><Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("email")}><Mail className="h-3.5 w-3.5" /> Email</Button><Button variant="outline" size="sm" disabled={!eventId || !guestId} onClick={() => sendMutation.mutate("sms")}><Smartphone className="h-3.5 w-3.5" /> SMS</Button></div><p className="mt-2 text-[10px] text-slate-400">Select an event and guest to activate delivery.</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LayerText({ layer, value, position, active, onSelect, onDragStart, style }: { layer: Layer; value: string; position: { x: number; y: number }; active: boolean; onSelect: (layer: Layer) => void; onDragStart: (layer: Layer) => void; style: React.CSSProperties }) {
  return <button type="button" onPointerDown={(event) => { event.stopPropagation(); onSelect(layer); onDragStart(layer); }} onClick={(event) => { event.stopPropagation(); onSelect(layer); }} className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap px-2 py-1 text-center transition active:cursor-grabbing ${active ? "ring-2 ring-gold-300 ring-offset-2" : "hover:ring-1 hover:ring-gold-200"}`} style={{ left: `${position.x}%`, top: `${position.y}%`, color: "inherit", ...style }}>{value}</button>;
}
