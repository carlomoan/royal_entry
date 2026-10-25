export interface QrPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardTemplateConfig {
  id?: string;
  name?: string;
  front_file_id?: string;
  front_image_url: string;
  qr_position: QrPosition;
}

/**
 * Card template record as returned by the backend list/get endpoints.
 * `theme_config` is the free-form JSON blob the studio writes; the studio
 * understands the `front_file_id` + `qr_position` shape it stores.
 */
export interface CardTemplateRecord {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  theme_config: {
    front_file_id?: string;
    qr_position?: QrPosition;
    [key: string]: unknown;
  };
  background_file_id: string | null;
  preview_image_url: string | null;
  is_active: boolean;
  /** Platform-published template, selectable by every organization. */
  is_global: boolean;
  /** Whether the requesting organization created this template (write access). */
  is_owned: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_QR_POSITION: QrPosition = { x: 65, y: 75, w: 20, h: 20 };

/** Sanitize a stored QR position into a safe, clamped 0–100% rectangle. */
export function clampQrPosition(value: Partial<QrPosition> | null | undefined): QrPosition {
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    x: num(value?.x, DEFAULT_QR_POSITION.x, 0, 100),
    y: num(value?.y, DEFAULT_QR_POSITION.y, 0, 100),
    w: num(value?.w, DEFAULT_QR_POSITION.w, 5, 50),
    h: num(value?.h, DEFAULT_QR_POSITION.h, 5, 50),
  };
}