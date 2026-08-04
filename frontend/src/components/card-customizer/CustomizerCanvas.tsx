// ==============================================================================
// FILE: src/components/card-customizer/CustomizerCanvas.tsx
// ==============================================================================
// Konva-based interactive canvas with drag, scale, rotate, select, and inline
// text editing. Renders the invitation at a fixed 500x700 aspect ratio.

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Image as KonvaImage,
  Transformer,
  Star,
  Ring,
  Ellipse,
  Line,
} from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import type { CanvasElement, BackgroundConfig } from "./types";
import { CARD_WIDTH, CARD_HEIGHT } from "./templates";

// ── Image element wrapper ─────────────────────────────────────────────────────

function ImageElement({
  element,
  isSelected: _isSelected,
  onSelect,
  onChange,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
}) {
  const [img] = useImage(element.src ?? "", "anonymous");
  const shapeRef = useRef<Konva.Image>(null);

  return (
    <KonvaImage
      ref={shapeRef}
      image={img}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * scaleX),
          height: Math.max(20, node.height() * scaleY),
          rotation: node.rotation(),
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
}

// ── Text element with inline editing ──────────────────────────────────────────

function TextElement({
  element,
  isSelected: _isSelected,
  onSelect,
  onChange,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
}) {
  const shapeRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.text ?? "");

  // Position a textarea over the Konva text for inline editing
  const [textareaPos, setTextareaPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleDoubleTap = useCallback(() => {
    const node = shapeRef.current;
    if (!node) return;
    const stage = node.getStage();
    if (!stage) return;
    const containerRect = stage.container().getBoundingClientRect();
    const textPos = node.getAbsolutePosition();
    setTextareaPos({
      x: containerRect.left + textPos.x,
      y: containerRect.top + textPos.y,
    });
    setEditValue(element.text ?? "");
    setIsEditing(true);
  }, [element.text]);

  useEffect(() => {
    if (!isEditing) return;

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.value = editValue;
    textarea.style.position = "fixed";
    textarea.style.top = `${textareaPos?.y ?? 0}px`;
    textarea.style.left = `${textareaPos?.x ?? 0}px`;
    textarea.style.width = `${element.width}px`;
    textarea.style.height = `${element.height}px`;
    textarea.style.fontSize = `${element.fontSize ?? 24}px`;
    textarea.style.fontFamily = element.fontFamily ?? "Arial";
    textarea.style.color = element.fill ?? "#000000";
    textarea.style.border = "2px solid #fbbf24";
    textarea.style.borderRadius = "4px";
    textarea.style.padding = "0";
    textarea.style.margin = "0";
    textarea.style.background = "rgba(255,255,255,0.9)";
    textarea.style.outline = "none";
    textarea.style.resize = "none";
    textarea.style.zIndex = "9999";
    textarea.style.textAlign = element.align ?? "left";
    textarea.style.overflow = "hidden";
    textarea.style.lineHeight = "1.2";
    textarea.focus();
    textarea.select();

    const cleanup = () => {
      textarea.remove();
      setIsEditing(false);
    };

    textarea.addEventListener("blur", () => {
      onChange({ text: textarea.value });
      cleanup();
    });
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onChange({ text: textarea.value });
        cleanup();
      }
      if (e.key === "Escape") {
        cleanup();
      }
    });

    return () => {
      textarea.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  if (isEditing) return null;

  return (
    <Text
      ref={shapeRef}
      text={element.text}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      fontSize={element.fontSize ?? 24}
      fontFamily={element.fontFamily ?? "Arial"}
      fill={element.fill ?? "#000000"}
      fontStyle={element.fontStyle ?? "normal"}
      align={element.align ?? "left"}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={onSelect}
      onDblTap={handleDoubleTap}
      onDblClick={handleDoubleTap}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(50, node.width() * scaleX),
          rotation: node.rotation(),
          fontSize: Math.max(8, (element.fontSize ?? 24) * scaleX),
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
}

// ── Shape element ─────────────────────────────────────────────────────────────

function ShapeElement({
  element,
  isSelected: _isSelected,
  onSelect,
  onChange,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const common: any = {
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onMouseDown: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = shapeRef.current;
      if (!node) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      onChange({
        x: node.x(),
        y: node.y(),
        width: Math.max(10, element.width * scaleX),
        height: Math.max(10, element.height * scaleY),
        rotation: node.rotation(),
      });
      node.scaleX(1);
      node.scaleY(1);
    },
    ref: shapeRef,
  };

  switch (element.shape) {
    case "rect":
      return (
        <Rect
          {...common}
          width={element.width}
          height={element.height}
          fill={element.fill || undefined}
          stroke={element.stroke || undefined}
          strokeWidth={element.strokeWidth ?? 0}
          cornerRadius={element.cornerRadius ?? 0}
        />
      );
    case "circle":
    case "ellipse":
      return (
        <Ellipse
          {...common}
          radiusX={element.width / 2}
          radiusY={element.height / 2}
          fill={element.fill || undefined}
          stroke={element.stroke || undefined}
          strokeWidth={element.strokeWidth ?? 0}
        />
      );
    case "ring":
      return (
        <Ring
          {...common}
          innerRadius={element.innerRadius ?? 30}
          outerRadius={element.outerRadius ?? 45}
          fill={element.fill || undefined}
          stroke={element.stroke || undefined}
          strokeWidth={element.strokeWidth ?? 2}
        />
      );
    case "star":
      return (
        <Star
          {...common}
          numPoints={element.numPoints ?? 5}
          innerRadius={element.innerRadius ?? 20}
          outerRadius={element.outerRadius ?? 40}
          fill={element.fill || undefined}
          stroke={element.stroke || undefined}
          strokeWidth={element.strokeWidth ?? 0}
        />
      );
    case "line":
      return (
        <Line
          {...common}
          points={[0, 0, element.width, 0]}
          stroke={element.stroke ?? element.fill ?? "#000000"}
          strokeWidth={element.strokeWidth ?? 3}
          lineCap="round"
        />
      );
    default:
      return null;
  }
}

// ── Background renderer ───────────────────────────────────────────────────────

function BackgroundRect({ config }: { config: BackgroundConfig }) {
  if (config.mode === "solid") {
    return (
      <Rect
        x={0}
        y={0}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        fill={config.solidColor}
        listening={false}
      />
    );
  }

  // Convert angle to gradient vector
  const angleRad = (config.gradientAngle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  // Normalize to card bounds
  const startX = CARD_WIDTH / 2 - (dx * CARD_WIDTH) / 2;
  const startY = CARD_HEIGHT / 2 - (dy * CARD_HEIGHT) / 2;
  const endX = CARD_WIDTH / 2 + (dx * CARD_WIDTH) / 2;
  const endY = CARD_HEIGHT / 2 + (dy * CARD_HEIGHT) / 2;

  return (
    <Rect
      x={0}
      y={0}
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      fillLinearGradientStartPoint={{ x: startX, y: startY }}
      fillLinearGradientEndPoint={{ x: endX, y: endY }}
      fillLinearGradientColorStops={[
        0,
        config.gradientStart,
        1,
        config.gradientEnd,
      ]}
      listening={false}
    />
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────

interface CustomizerCanvasProps {
  elements: CanvasElement[];
  background: BackgroundConfig;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeElement: (id: string, patch: Partial<CanvasElement>) => void;
  onDeleteElement: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stageRef: React.RefObject<any>;
}

export default function CustomizerCanvas({
  elements,
  background,
  selectedId,
  onSelect,
  onChangeElement,
  onDeleteElement,
  stageRef,
}: CustomizerCanvasProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Responsive scaling — fit the 500x700 card into the container width
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const newScale = Math.min(containerWidth / CARD_WIDTH, 1);
      setScale(newScale);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Attach transformer to the selected node
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (selectedId) {
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformer.nodes([selectedNode]);
        transformer.getLayer()?.batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedId, elements, stageRef]);

  // Keyboard delete
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement;
        // Don't delete if user is typing in an input/textarea
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT"
        )
          return;
        e.preventDefault();
        onDeleteElement(selectedId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, onDeleteElement]);

  return (
    <div ref={containerRef} className="flex justify-center">
      <Stage
        ref={stageRef}
        width={CARD_WIDTH * scale}
        height={CARD_HEIGHT * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          // Deselect when clicking on empty stage
          if (e.target === e.target.getStage()) onSelect(null);
        }}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
        style={{
          background: "#f8fafc",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
        }}
      >
        <Layer>
          <BackgroundRect config={background} />
        </Layer>
        <Layer>
          {elements.map((el) => {
            const isSelected = el.id === selectedId;
            const common = {
              key: el.id,
              id: el.id,
              isSelected,
              onSelect: () => onSelect(el.id),
              onChange: (patch: Partial<CanvasElement>) =>
                onChangeElement(el.id, patch),
            };
            if (el.type === "text")
              return <TextElement {...common} element={el} />;
            if (el.type === "image")
              return <ImageElement {...common} element={el} />;
            if (el.type === "shape")
              return <ShapeElement {...common} element={el} />;
            return null;
          })}
          <Transformer
            ref={transformerRef}
            rotateAnchorOffset={20}
            borderStroke="#fbbf24"
            anchorStroke="#fbbf24"
            anchorFill="#ffffff"
            anchorSize={10}
            anchorCornerRadius={5}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit minimum size
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
