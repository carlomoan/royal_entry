// ==============================================================================
// FILE: src/data/cardTemplates.ts
// ==============================================================================
// Invitation card template registry.
// Each template is keyed by a stable string stored in the event `card_theme`
// field. Templates are categorized by event type and tier so organizers can
// pick the right card for the occasion and guest class.

export type EventType =
  | "wedding"
  | "corporate"
  | "cultural"
  | "birthday"
  | "conference"
  | "gala"
  | "religious"
  | "graduation"
  | "generic";

export type CardTier = "standard" | "premium" | "vip" | "vvip" | "compact";

export type CardLayout = "full" | "compact" | "ornate" | "split" | "stacked";

export interface CardTemplate {
  key: string;
  name: string;
  description: string;
  eventTypes: EventType[];
  tier: CardTier;
  layout: CardLayout;
  /** Outer accent gradient (Tailwind classes for `bg-gradient-to-br`). */
  accent: string;
  /** Shell background + base text color. */
  shell: string;
  /** Inner panel styling. */
  panel: string;
  /** Whether the shell is light (drives QR padding + contrast). */
  light?: boolean;
  /** Decorative monogram letter or symbol shown in the header. */
  monogram?: string;
  /** Divider style between sections. */
  divider?: "gold" | "silver" | "floral" | "geometric" | "minimal" | "double";
  /** Badge label shown on the card (e.g. "VVIP", "Premium"). */
  badge?: string;
}

export const EVENT_TYPES: { key: EventType; label: string }[] = [
  { key: "generic", label: "All occasions" },
  { key: "wedding", label: "Wedding" },
  { key: "corporate", label: "Corporate" },
  { key: "cultural", label: "Cultural" },
  { key: "birthday", label: "Birthday" },
  { key: "conference", label: "Conference" },
  { key: "gala", label: "Gala" },
  { key: "religious", label: "Religious" },
  { key: "graduation", label: "Graduation" },
];

export const CARD_TIERS: { key: CardTier; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
  { key: "vip", label: "VIP" },
  { key: "vvip", label: "VVIP" },
  { key: "compact", label: "Compact" },
];

export const cardTemplates: CardTemplate[] = [
  // ── Wedding ────────────────────────────────────────────────────────────────
  {
    key: "elegant_gold",
    name: "Elegant Gold",
    description: "Faux gold calligraphy on cream — timeless formal weddings.",
    eventTypes: ["wedding"],
    tier: "premium",
    layout: "ornate",
    accent: "from-gold-300 via-gold-500 to-amber-700",
    shell:
      "bg-gradient-to-br from-amber-50 via-white to-gold-50 text-slate-900",
    panel: "bg-gold-50/80 border-gold-200",
    light: true,
    monogram: "❦",
    divider: "gold",
    badge: "Premium",
  },
  {
    key: "royal_vvip",
    name: "Royal VVIP",
    description:
      "Deep navy with ornate gold frame — the utmost wedding honour.",
    eventTypes: ["wedding", "gala"],
    tier: "vvip",
    layout: "ornate",
    accent: "from-gold-400 via-amber-600 to-gold-800",
    shell:
      "bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-white",
    panel: "bg-white/10 border-gold-400/30",
    monogram: "♛",
    divider: "gold",
    badge: "VVIP",
  },
  {
    key: "botanical_blush",
    name: "Botanical Blush",
    description: "Sage green and blush pink — romantic garden weddings.",
    eventTypes: ["wedding"],
    tier: "premium",
    layout: "full",
    accent: "from-rose-300 via-pink-400 to-emerald-400",
    shell:
      "bg-gradient-to-br from-emerald-50 via-white to-rose-50 text-slate-900",
    panel: "bg-white/70 border-emerald-200",
    light: true,
    monogram: "❀",
    divider: "floral",
    badge: "Premium",
  },

  // ── Corporate / Conference ──────────────────────────────────────────────────
  {
    key: "modern_midnight",
    name: "Modern Midnight",
    description:
      "Slate-to-black gradient — sleek corporate dinners and launches.",
    eventTypes: ["corporate", "gala"],
    tier: "premium",
    layout: "split",
    accent: "from-navy-700 via-slate-800 to-black",
    shell: "bg-gradient-to-br from-slate-900 via-navy-900 to-black text-white",
    panel: "bg-white/10 border-white/15",
    monogram: "◆",
    divider: "minimal",
    badge: "Premium",
  },
  {
    key: "corporate_executive",
    name: "Corporate Executive",
    description: "Navy and white — structured boardroom and executive events.",
    eventTypes: ["corporate"],
    tier: "standard",
    layout: "full",
    accent: "from-navy-500 via-navy-700 to-navy-900",
    shell: "bg-white text-slate-900",
    panel: "bg-navy-50 border-navy-200",
    light: true,
    monogram: "■",
    divider: "minimal",
    badge: "Standard",
  },
  {
    key: "conference_tech",
    name: "Conference Tech",
    description: "Bright blue and white — modern tech summits and meetups.",
    eventTypes: ["conference"],
    tier: "standard",
    layout: "split",
    accent: "from-sky-400 via-blue-500 to-indigo-600",
    shell: "bg-gradient-to-br from-white via-sky-50 to-blue-50 text-slate-900",
    panel: "bg-white/80 border-sky-200",
    light: true,
    monogram: "▶",
    divider: "geometric",
    badge: "Standard",
  },

  // ── Cultural ────────────────────────────────────────────────────────────────
  {
    key: "traditional_royal",
    name: "Traditional Royal",
    description: "Vibrant rose, fuchsia and purple — cultural ceremonies.",
    eventTypes: ["cultural", "wedding"],
    tier: "premium",
    layout: "full",
    accent: "from-rose-500 via-fuchsia-600 to-purple-700",
    shell:
      "bg-gradient-to-br from-fuchsia-50 via-white to-purple-50 text-slate-900",
    panel: "bg-white/70 border-fuchsia-200",
    light: true,
    monogram: "✦",
    divider: "floral",
    badge: "Premium",
  },
  {
    key: "cultural_kanga",
    name: "Cultural Kanga",
    description: "Warm earth tones inspired by East African kanga patterns.",
    eventTypes: ["cultural"],
    tier: "standard",
    layout: "full",
    accent: "from-orange-400 via-red-500 to-amber-600",
    shell:
      "bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 text-slate-900",
    panel: "bg-white/70 border-orange-200",
    light: true,
    monogram: "☼",
    divider: "geometric",
    badge: "Standard",
  },

  // ── Birthday ────────────────────────────────────────────────────────────────
  {
    key: "celebration_color",
    name: "Celebration Color",
    description: "Sky, emerald and gold — youthful festive birthdays.",
    eventTypes: ["birthday"],
    tier: "standard",
    layout: "full",
    accent: "from-sky-400 via-emerald-400 to-gold-400",
    shell:
      "bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900",
    panel: "bg-white/70 border-sky-200",
    light: true,
    monogram: "✺",
    divider: "geometric",
    badge: "Standard",
  },
  {
    key: "birthday_festive",
    name: "Birthday Festive",
    description: "Bright multi-color confetti vibe — kids and teen parties.",
    eventTypes: ["birthday"],
    tier: "standard",
    layout: "stacked",
    accent: "from-pink-400 via-yellow-400 to-violet-500",
    shell:
      "bg-gradient-to-br from-yellow-50 via-pink-50 to-violet-50 text-slate-900",
    panel: "bg-white/70 border-pink-200",
    light: true,
    monogram: "★",
    divider: "geometric",
    badge: "Standard",
  },

  // ── Gala ────────────────────────────────────────────────────────────────────
  {
    key: "art_deco_gold",
    name: "Art Deco Gold",
    description: "Black and gold geometric — roaring twenties galas.",
    eventTypes: ["gala"],
    tier: "vip",
    layout: "ornate",
    accent: "from-gold-400 via-amber-500 to-yellow-700",
    shell: "bg-gradient-to-br from-black via-navy-950 to-black text-white",
    panel: "bg-white/10 border-gold-400/40",
    monogram: "❖",
    divider: "geometric",
    badge: "VIP",
  },
  {
    key: "gala_blacktie",
    name: "Gala Black Tie",
    description: "Pure black with gold accents — formal black-tie galas.",
    eventTypes: ["gala"],
    tier: "vvip",
    layout: "ornate",
    accent: "from-gold-500 via-amber-600 to-gold-800",
    shell: "bg-gradient-to-br from-black via-zinc-900 to-black text-white",
    panel: "bg-white/10 border-gold-500/40",
    monogram: "♛",
    divider: "gold",
    badge: "VVIP",
  },

  // ── Religious ───────────────────────────────────────────────────────────────
  {
    key: "religious_dove",
    name: "Serene Dove",
    description: "Soft blue and white — baptisms, dedications and prayers.",
    eventTypes: ["religious"],
    tier: "premium",
    layout: "full",
    accent: "from-sky-300 via-blue-300 to-indigo-300",
    shell: "bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900",
    panel: "bg-white/70 border-sky-200",
    light: true,
    monogram: "✝",
    divider: "floral",
    badge: "Premium",
  },

  // ── Graduation ──────────────────────────────────────────────────────────────
  {
    key: "graduation_honors",
    name: "Graduation Honors",
    description: "Navy and gold — academic ceremonies and graduations.",
    eventTypes: ["graduation"],
    tier: "premium",
    layout: "full",
    accent: "from-navy-500 via-navy-700 to-gold-600",
    shell: "bg-gradient-to-br from-navy-50 via-white to-gold-50 text-slate-900",
    panel: "bg-white/70 border-navy-200",
    light: true,
    monogram: "🎓",
    divider: "double",
    badge: "Premium",
  },

  // ── Cross-tier / Generic ────────────────────────────────────────────────────
  {
    key: "minimal_pearl",
    name: "Minimal Pearl",
    description: "Clean white and slate — executive clarity for any occasion.",
    eventTypes: ["generic", "corporate"],
    tier: "standard",
    layout: "full",
    accent: "from-slate-200 via-white to-slate-100",
    shell: "bg-white text-slate-900",
    panel: "bg-slate-50 border-slate-200",
    light: true,
    monogram: "·",
    divider: "minimal",
    badge: "Standard",
  },
  {
    key: "midnight_vip",
    name: "Midnight VIP",
    description: "Black with silver accents — premium VIP access pass.",
    eventTypes: ["generic", "corporate", "gala"],
    tier: "vip",
    layout: "split",
    accent: "from-slate-400 via-slate-600 to-slate-800",
    shell: "bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white",
    panel: "bg-white/10 border-slate-300/30",
    monogram: "★",
    divider: "silver",
    badge: "VIP",
  },
  {
    key: "vip_champagne",
    name: "VIP Champagne",
    description: "Champagne and rose gold — elegant VIP celebrations.",
    eventTypes: ["generic", "wedding", "gala"],
    tier: "vip",
    layout: "ornate",
    accent: "from-rose-300 via-amber-300 to-yellow-500",
    shell:
      "bg-gradient-to-br from-amber-50 via-rose-50 to-white text-slate-900",
    panel: "bg-white/70 border-rose-200",
    light: true,
    monogram: "❦",
    divider: "gold",
    badge: "VIP",
  },
  {
    key: "vvip_platinum",
    name: "VVIP Platinum",
    description: "Platinum and silver — the highest honour for any event.",
    eventTypes: ["generic", "gala", "corporate"],
    tier: "vvip",
    layout: "ornate",
    accent: "from-slate-300 via-slate-400 to-slate-600",
    shell:
      "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900",
    panel: "bg-white/80 border-slate-300",
    light: true,
    monogram: "♛",
    divider: "silver",
    badge: "VVIP",
  },

  // ── Compact (pocket pass for any event) ─────────────────────────────────────
  {
    key: "compact_pass",
    name: "Compact Pass",
    description: "Pocket-sized access pass — efficient for high-volume events.",
    eventTypes: ["generic", "conference", "corporate"],
    tier: "compact",
    layout: "compact",
    accent: "from-navy-500 via-navy-700 to-navy-900",
    shell: "bg-white text-slate-900",
    panel: "bg-navy-50 border-navy-200",
    light: true,
    monogram: "▶",
    divider: "minimal",
    badge: "Compact",
  },
  {
    key: "compact_pocket",
    name: "Compact Pocket",
    description: "Slim dark pocket card — discreet VIP door entry.",
    eventTypes: ["generic", "gala", "corporate"],
    tier: "compact",
    layout: "compact",
    accent: "from-slate-700 via-slate-800 to-black",
    shell: "bg-gradient-to-br from-slate-900 to-black text-white",
    panel: "bg-white/10 border-white/15",
    monogram: "◆",
    divider: "minimal",
    badge: "Compact",
  },
];

/** Legacy theme keys mapped to their renamed equivalents for backward compat. */
const legacyKeyMap: Record<string, string> = {
  elegant: "elegant_gold",
  modern: "modern_midnight",
  traditional: "traditional_royal",
  colorful: "celebration_color",
  minimal: "minimal_pearl",
};

/** Look up a template by key, falling back to a sensible default. */
export function getTemplate(key?: string): CardTemplate {
  if (!key) return cardTemplates.find((t) => t.key === "modern_midnight")!;
  const resolved = legacyKeyMap[key] ?? key;
  return (
    cardTemplates.find((t) => t.key === resolved) ??
    cardTemplates.find((t) => t.key === "modern_midnight")!
  );
}

/** Filter templates by event type and/or tier. */
export function filterTemplates(
  eventType?: EventType | "all",
  tier?: CardTier | "all",
): CardTemplate[] {
  return cardTemplates.filter((t) => {
    const matchesType =
      !eventType || eventType === "all" || t.eventTypes.includes(eventType);
    const matchesTier = !tier || tier === "all" || t.tier === tier;
    return matchesType && matchesTier;
  });
}
