// ==============================================================================
// FILE: src/components/card-customizer/CardCustomizer.tsx
// ==============================================================================
// Main Invitation Card Template Customizer — ties together the interactive
// Konva canvas with all sidebar control panels.

import { useState, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import CustomizerCanvas from "./CustomizerCanvas";
import {
  TemplatePanel,
  GraphicsPanel,
  TypographyPanel,
  ColorPanel,
  ExportPanel,
  ElementActions,
} from "./SidebarPanels";
import { adminTemplates, CARD_WIDTH, CARD_HEIGHT } from "./templates";
import type {
  BackgroundConfig,
  CanvasElement,
  CardTemplate,
  GraphicItem,
} from "./types";

let elementIdCounter = 0;
const genId = () => `el-${Date.now()}-${elementIdCounter++}`;

function templateToElements(template: CardTemplate): CanvasElement[] {
  return template.elements.map((el) => ({ ...el, id: genId() }));
}

export default function CardCustomizer() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [elements, setElements] = useState<CanvasElement[]>(() =>
    templateToElements(adminTemplates[0]),
  );
  const [background, setBackground] = useState<BackgroundConfig>(
    adminTemplates[0].background,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  // ── Element operations ─────────────────────────────────────────────────────
  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      );
    },
    [],
  );

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  }, []);

  const addText = useCallback(() => {
    const newEl: CanvasElement = {
      id: genId(),
      type: "text",
      x: 100,
      y: 300,
      width: 300,
      height: 40,
      rotation: 0,
      text: "New text block",
      fontSize: 24,
      fontFamily: "Georgia",
      fill: "#1e293b",
      fontStyle: "normal",
      align: "center",
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  }, []);

  const addGraphic = useCallback((item: GraphicItem) => {
    const newEl: CanvasElement = {
      id: genId(),
      type: "text", // Emoji rendered as text node
      x: CARD_WIDTH / 2 - item.defaultWidth / 2,
      y: CARD_HEIGHT / 2 - item.defaultHeight / 2,
      width: item.defaultWidth,
      height: item.defaultHeight,
      rotation: 0,
      text: item.emoji ?? "✨",
      fontSize: item.defaultWidth * 0.9,
      fontFamily: "Arial",
      fill: "#000000",
      fontStyle: "normal",
      align: "center",
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
    toast.success(`${item.name} added`);
  }, []);

  const loadTemplate = useCallback((template: CardTemplate) => {
    setElements(templateToElements(template));
    setBackground(template.background);
    setSelectedId(null);
    toast.success(`Loaded template: ${template.name}`);
  }, []);

  // ── Background updates ─────────────────────────────────────────────────────
  const updateBackground = useCallback((patch: Partial<BackgroundConfig>) => {
    setBackground((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const getStageDataURL = useCallback((): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    // Temporarily reset scale for full-resolution export
    const prevScaleX = stage.scaleX();
    const prevScaleY = stage.scaleY();
    stage.scale({ x: 1, y: 1 });
    stage.width(CARD_WIDTH);
    stage.height(CARD_HEIGHT);
    stage.draw();
    const dataUrl = stage.toDataURL({
      pixelRatio: 2,
      mimeType: "image/png",
    });
    // Restore scale
    stage.scale({ x: prevScaleX, y: prevScaleY });
    stage.draw();
    return dataUrl;
  }, []);

  const exportPNG = useCallback(() => {
    setIsExporting(true);
    try {
      const dataUrl = getStageDataURL();
      if (!dataUrl) {
        toast.error("Could not export canvas");
        return;
      }
      const link = document.createElement("a");
      link.download = `invitation-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PNG exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [getStageDataURL]);

  const exportPDF = useCallback(() => {
    setIsExporting(true);
    try {
      const dataUrl = getStageDataURL();
      if (!dataUrl) {
        toast.error("Could not export canvas");
        return;
      }
      // Create PDF at the card's aspect ratio (500x700 → 5x7 inches)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [CARD_WIDTH, CARD_HEIGHT],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, CARD_WIDTH, CARD_HEIGHT);
      pdf.save(`invitation-${Date.now()}.pdf`);
      toast.success("PDF exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [getStageDataURL]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Canvas area */}
      <div className="flex-1 min-w-0">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Canvas
              </h3>
              <p className="text-xs text-slate-400">
                {CARD_WIDTH} × {CARD_HEIGHT}px · Drag, resize, rotate ·
                Double-click text to edit
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {elements.length} element{elements.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <CustomizerCanvas
            elements={elements}
            background={background}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChangeElement={updateElement}
            onDeleteElement={deleteElement}
            stageRef={stageRef}
          />
        </div>
      </div>

      {/* Sidebar controls */}
      <div className="flex w-full flex-col gap-3 lg:w-80 lg:flex-shrink-0">
        <TemplatePanel onLoad={loadTemplate} />
        <GraphicsPanel onAddGraphic={addGraphic} />
        <TypographyPanel
          selectedElement={selectedElement}
          onUpdateElement={(patch) =>
            selectedId && updateElement(selectedId, patch)
          }
          onAddText={addText}
        />
        <ColorPanel background={background} onUpdate={updateBackground} />
        <ExportPanel
          onExportPNG={exportPNG}
          onExportPDF={exportPDF}
          isExporting={isExporting}
        />
        <ElementActions
          selectedElement={selectedElement}
          onDelete={() => selectedId && deleteElement(selectedId)}
        />
      </div>
    </div>
  );
}
