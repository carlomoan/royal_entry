// ==============================================================================
// FILE: src/components/card-customizer/types.ts
// ==============================================================================
// Shared types for the Invitation Card Template Customizer.

export type ElementType = "text" | "image" | "shape";

export type ShapeKind = "rect" | "circle" | "ellipse" | "ring" | "star" | "line";

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontStyle?: string;
  align?: "left" | "center" | "right";
  // Image-specific
  src?: string;
  // Shape-specific
  shape?: ShapeKind;
  cornerRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  numPoints?: number;
  innerRadius?: number;
  outerRadius?: number;
  // Z-order
  zIndex?: number;
}

export type BackgroundMode = "solid" | "gradient";

export interface BackgroundConfig {
  mode: BackgroundMode;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number; // degrees 0-360
}

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  background: BackgroundConfig;
  elements: Omit<CanvasElement, "id">[];
}

export interface GraphicItem {
  id: string;
  name: string;
  category: "flower" | "decor" | "shape" | "icon";
  // For emoji-based graphics we use text; for SVG/image we use src
  emoji?: string;
  src?: string;
  defaultWidth: number;
  defaultHeight: number;
}
