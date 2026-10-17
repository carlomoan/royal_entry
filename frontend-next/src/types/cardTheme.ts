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
