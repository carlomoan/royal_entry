// ==============================================================================
// FILE: src/components/card-customizer/SidebarPanels.tsx
// ==============================================================================
// All sidebar control panels for the customizer: templates, graphics injector,
// typography, advanced color controller, and export.

import { useState } from "react";
import {
  LayoutTemplate,
  Flower2,
  Type,
  Palette,
  Download,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  adminTemplates,
  graphicLibrary,
  FONT_FAMILIES,
  PRESET_COLORS,
  CARD_WIDTH,
  CARD_HEIGHT,
} from "./templates";
import type { BackgroundConfig, CanvasElement, CardTemplate, GraphicItem } from "./types";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof LayoutTemplate;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold-600" />
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

// ── Template panel ────────────────────────────────────────────────────────────

export function TemplatePanel({
  onLoad,
}: {
  onLoad: (template: CardTemplate) => void;
}) {
  return (
    <Section title="Templates" icon={LayoutTemplate}>
      <p className="mb-3 text-xs text-slate-500">
        Choose a pre-designed template to start. Loading replaces the current canvas.
      </p>
      <div className="grid gap-3">
        {adminTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onLoad(tpl)}
            className="group rounded-xl border border-slate-200 p-3 text-left transition hover:border-gold-300 hover:bg-gold-50/50"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-14 w-10 flex-shrink-0 rounded-lg border border-slate-200"
                style={{
                  background:
                    tpl.background.mode === "gradient"
                      ? `linear-gradient(${tpl.background.gradientAngle}deg, ${tpl.background.gradientStart}, ${tpl.background.gradientEnd})`
                      : tpl.background.solidColor,
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{tpl.name}</p>
                <p className="truncate text-xs text-slate-500">{tpl.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ── Graphics injector panel ───────────────────────────────────────────────────

export function GraphicsPanel({
  onAddGraphic,
}: {
  onAddGraphic: (item: GraphicItem) => void;
}) {
  const categories: GraphicItem["category"][] = ["flower", "decor", "icon"];
  const [activeCat, setActiveCat] = useState<GraphicItem["category"]>("flower");

  const items = graphicLibrary.filter((g) => g.category === activeCat);

  return (
    <Section title="Flowers & Graphics" icon={Flower2}>
      <div className="mb-3 flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
              activeCat === cat
                ? "bg-navy-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-slate-500">Click any item to add it to the canvas.</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onAddGraphic(item)}
            title={item.name}
            className="flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl transition hover:border-gold-300 hover:bg-gold-50 hover:scale-105"
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </Section>
  );
}

// ── Typography panel ──────────────────────────────────────────────────────────

export function TypographyPanel({
  selectedElement,
  onUpdateElement,
  onAddText,
}: {
  selectedElement: CanvasElement | null;
  onUpdateElement: (patch: Partial<CanvasElement>) => void;
  onAddText: () => void;
}) {
  const isText = selectedElement?.type === "text";

  return (
    <Section title="Typography" icon={Type}>
      <button
        onClick={onAddText}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold-300 bg-gold-50/50 py-2.5 text-sm font-semibold text-gold-700 transition hover:bg-gold-100"
      >
        <Plus className="h-4 w-4" /> Add text block
      </button>

      {!isText ? (
        <p className="text-xs text-slate-400">
          Select a text element on the canvas to edit its content, font, size, and color. Double-click text to edit inline.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Content</label>
            <textarea
              value={selectedElement.text ?? ""}
              onChange={(e) => onUpdateElement({ text: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Font family</label>
              <select
                value={selectedElement.fontFamily ?? "Arial"}
                onChange={(e) => onUpdateElement({ fontFamily: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Size</label>
              <input
                type="number"
                min={8}
                max={120}
                value={selectedElement.fontSize ?? 24}
                onChange={(e) => onUpdateElement({ fontSize: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Style</label>
              <select
                value={selectedElement.fontStyle ?? "normal"}
                onChange={(e) => onUpdateElement({ fontStyle: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="bold italic">Bold Italic</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Align</label>
              <select
                value={selectedElement.align ?? "left"}
                onChange={(e) => onUpdateElement({ align: e.target.value as "left" | "center" | "right" })}
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Text color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedElement.fill ?? "#000000"}
                onChange={(e) => onUpdateElement({ fill: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={selectedElement.fill ?? "#000000"}
                onChange={(e) => onUpdateElement({ fill: e.target.value })}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_COLORS.slice(0, 12).map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateElement({ fill: c })}
                  className="h-6 w-6 rounded border border-slate-200 transition hover:scale-110"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Advanced color controller ─────────────────────────────────────────────────

export function ColorPanel({
  background,
  onUpdate,
}: {
  background: BackgroundConfig;
  onUpdate: (patch: Partial<BackgroundConfig>) => void;
}) {
  return (
    <Section title="Background" icon={Palette}>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => onUpdate({ mode: "solid" })}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            background.mode === "solid"
              ? "bg-navy-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Solid Color
        </button>
        <button
          onClick={() => onUpdate({ mode: "gradient" })}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            background.mode === "gradient"
              ? "bg-navy-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Gradient
        </button>
      </div>

      {background.mode === "solid" ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Background color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={background.solidColor}
              onChange={(e) => onUpdate({ solidColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-gray-300"
            />
            <input
              type="text"
              value={background.solidColor}
              onChange={(e) => onUpdate({ solidColor: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:border-transparent focus:ring-2 focus:ring-gold-400"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ solidColor: c })}
                className="h-6 w-6 rounded border border-slate-200 transition hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Start color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={background.gradientStart}
                  onChange={(e) => onUpdate({ gradientStart: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={background.gradientStart}
                  onChange={(e) => onUpdate({ gradientStart: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-gold-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">End color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={background.gradientEnd}
                  onChange={(e) => onUpdate({ gradientEnd: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={background.gradientEnd}
                  onChange={(e) => onUpdate({ gradientEnd: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-gold-400"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Angle: {background.gradientAngle}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={background.gradientAngle}
              onChange={(e) => onUpdate({ gradientAngle: Number(e.target.value) })}
              className="w-full accent-gold-500"
            />
          </div>
          {/* Gradient preview */}
          <div
            className="h-16 w-full rounded-xl border border-slate-200"
            style={{
              background: `linear-gradient(${background.gradientAngle}deg, ${background.gradientStart}, ${background.gradientEnd})`,
            }}
          />
          {/* Quick gradient presets */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { start: "#fbbf24", end: "#92400e", angle: 135, label: "Gold" },
              { start: "#1e3a5f", end: "#040d18", angle: 180, label: "Navy" },
              { start: "#f0abfc", end: "#fbbf24", angle: 90, label: "Festive" },
              { start: "#dc2626", end: "#7c3aed", angle: 45, label: "Royal" },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() =>
                  onUpdate({
                    gradientStart: preset.start,
                    gradientEnd: preset.end,
                    gradientAngle: preset.angle,
                  })
                }
                className="rounded-lg border border-slate-200 p-1 text-center transition hover:border-gold-300"
              >
                <div
                  className="mb-1 h-8 w-full rounded"
                  style={{ background: `linear-gradient(${preset.angle}deg, ${preset.start}, ${preset.end})` }}
                />
                <span className="text-[10px] font-medium text-slate-500">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Export panel ──────────────────────────────────────────────────────────────

export function ExportPanel({
  onExportPNG,
  onExportPDF,
  isExporting,
}: {
  onExportPNG: () => void;
  onExportPDF: () => void;
  isExporting: boolean;
}) {
  return (
    <Section title="Export" icon={Download} defaultOpen={false}>
      <p className="mb-3 text-xs text-slate-500">
        Download your invitation as a high-quality PNG or PDF.
      </p>
      <div className="space-y-2">
        <button
          onClick={onExportPNG}
          disabled={isExporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download PNG
        </button>
        <button
          onClick={onExportPDF}
          disabled={isExporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-gold-300 hover:bg-gold-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>
    </Section>
  );
}

// ── Element actions (delete selected) ────────────────────────────────────────

export function ElementActions({
  selectedElement,
  onDelete,
}: {
  selectedElement: CanvasElement | null;
  onDelete: () => void;
}) {
  if (!selectedElement) return null;
  return (
    <button
      onClick={onDelete}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
    >
      <Trash2 className="h-4 w-4" /> Delete selected element
    </button>
  );
}

// Re-export canvas dimensions for convenience
export { CARD_WIDTH, CARD_HEIGHT };
