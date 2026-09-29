// ==============================================================================
// FILE: crates/cloud/src/cards/renderer.rs
// ==============================================================================
use image::{DynamicImage, ImageEncoder, Rgba, RgbaImage};
use rusttype::{point, Font, Scale};
use serde_json::Value;
use std::path::Path;

use crate::error::{AppError, AppResult};

/// Theme config structure matching the frontend Card Studio
#[derive(Debug, Clone)]
pub struct CardThemeConfig {
    pub background_color: String,
    pub text_color: String,
    pub accent_color: String,
    pub font_family: String,
    pub positions: std::collections::HashMap<String, (f32, f32)>,
    pub text_configs: std::collections::HashMap<String, TextLayerConfig>,
    pub custom_texts: Vec<CustomTextLayer>,
}

#[derive(Debug, Clone)]
pub struct TextLayerConfig {
    pub font_size: f32,
    pub color: String,
    pub font_family: String,
    pub text_align: String,
    pub font_weight: String,
    pub letter_spacing: f32,
    pub line_height: f32,
}

#[derive(Debug, Clone)]
pub struct CustomTextLayer {
    pub content: String,
    pub x: f32,
    pub y: f32,
    pub font_size: f32,
    pub color: String,
    pub font_family: String,
    pub font_weight: String,
    pub text_align: String,
    pub letter_spacing: f32,
    pub line_height: f32,
    pub shape: String,
    pub arc_radius: f32,
    pub rotation: f32,
    pub max_width: f32,
    pub visible: bool,
}

/// Parse hex color string to RGBA tuple
fn parse_color(color: &str, default: (u8, u8, u8, u8)) -> (u8, u8, u8, u8) {
    let color = color.trim().trim_start_matches('#');
    if color.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&color[0..2], 16),
            u8::from_str_radix(&color[2..4], 16),
            u8::from_str_radix(&color[4..6], 16),
        ) {
            return (r, g, b, 255);
        }
    }
    default
}

/// Load font from configured path, with fallbacks
fn load_font(font_family: &str) -> Font<'static> {
    // Map font family names to file paths
    let font_path = match font_family {
        "Playfair Display" => std::env::var("CARD_FONT_PLAYFAIR")
            .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf".to_string()),
        "Great Vibes" => std::env::var("CARD_FONT_GREATVIBES")
            .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf".to_string()),
        "DM Sans" => std::env::var("CARD_FONT_DMSANS")
            .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf".to_string()),
        _ => std::env::var("CARD_FONT_PATH")
            .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf".to_string()),
    };

    // Try to load the font
    if let Ok(font_data) = std::fs::read(&font_path) {
        if let Some(font) = Font::try_from_vec(font_data) {
            return font;
        }
    }

    // Fallback: try common system fonts
    let fallbacks = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
    ];

    for path in &fallbacks {
        if let Ok(font_data) = std::fs::read(path) {
            if let Some(font) = Font::try_from_vec(font_data) {
                return font;
            }
        }
    }

    // Last resort: embedded minimal font data (will render boxes but won't crash)
    panic!("No font file found. Set CARD_FONT_PATH environment variable or install DejaVu fonts.")
}

/// Parse theme_config JSON into CardThemeConfig
pub fn parse_theme_config(config: &Value) -> AppResult<CardThemeConfig> {
    let obj = config
        .as_object()
        .ok_or_else(|| AppError::BadRequest("Invalid theme_config: expected object".to_string()))?;

    let get_str = |key: &str, default: &str| -> String {
        obj.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or(default)
            .to_string()
    };

    let positions = if let Some(pos_obj) = obj.get("positions").and_then(|v| v.as_object()) {
        let mut map = std::collections::HashMap::new();
        for (key, val) in pos_obj {
            if let Some(pos) = val.as_object() {
                let x = pos.get("x").and_then(|v| v.as_f64()).unwrap_or(50.0) as f32;
                let y = pos.get("y").and_then(|v| v.as_f64()).unwrap_or(50.0) as f32;
                map.insert(key.clone(), (x, y));
            }
        }
        map
    } else {
        std::collections::HashMap::new()
    };

    let text_configs = if let Some(tc_obj) = obj.get("text_configs").and_then(|v| v.as_object()) {
        let mut map = std::collections::HashMap::new();
        for (key, val) in tc_obj {
            if let Some(tc) = val.as_object() {
                map.insert(
                    key.clone(),
                    TextLayerConfig {
                        font_size: tc.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(16.0)
                            as f32,
                        color: tc
                            .get("color")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        font_family: tc
                            .get("fontFamily")
                            .and_then(|v| v.as_str())
                            .unwrap_or("DM Sans")
                            .to_string(),
                        text_align: tc
                            .get("textAlign")
                            .and_then(|v| v.as_str())
                            .unwrap_or("center")
                            .to_string(),
                        font_weight: tc
                            .get("fontWeight")
                            .and_then(|v| v.as_str())
                            .unwrap_or("400")
                            .to_string(),
                        letter_spacing: tc
                            .get("letterSpacing")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0) as f32,
                        line_height: tc.get("lineHeight").and_then(|v| v.as_f64()).unwrap_or(1.2)
                            as f32,
                    },
                );
            }
        }
        map
    } else {
        std::collections::HashMap::new()
    };

    let custom_texts = if let Some(ct_arr) = obj.get("custom_texts").and_then(|v| v.as_array()) {
        ct_arr
            .iter()
            .filter_map(|val| {
                val.as_object().map(|ct| CustomTextLayer {
                    content: ct
                        .get("content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    x: ct.get("x").and_then(|v| v.as_f64()).unwrap_or(50.0) as f32,
                    y: ct.get("y").and_then(|v| v.as_f64()).unwrap_or(50.0) as f32,
                    font_size: ct.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(16.0) as f32,
                    color: ct
                        .get("color")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    font_family: ct
                        .get("fontFamily")
                        .and_then(|v| v.as_str())
                        .unwrap_or("DM Sans")
                        .to_string(),
                    font_weight: ct
                        .get("fontWeight")
                        .and_then(|v| v.as_str())
                        .unwrap_or("400")
                        .to_string(),
                    text_align: ct
                        .get("textAlign")
                        .and_then(|v| v.as_str())
                        .unwrap_or("center")
                        .to_string(),
                    letter_spacing: ct
                        .get("letterSpacing")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0) as f32,
                    line_height: ct.get("lineHeight").and_then(|v| v.as_f64()).unwrap_or(1.2)
                        as f32,
                    shape: ct
                        .get("shape")
                        .and_then(|v| v.as_str())
                        .unwrap_or("straight")
                        .to_string(),
                    arc_radius: ct
                        .get("arcRadius")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(200.0) as f32,
                    rotation: ct.get("rotation").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                    max_width: ct.get("maxWidth").and_then(|v| v.as_f64()).unwrap_or(80.0) as f32,
                    visible: ct.get("visible").and_then(|v| v.as_bool()).unwrap_or(true),
                })
            })
            .collect()
    } else {
        Vec::new()
    };

    Ok(CardThemeConfig {
        background_color: get_str("background_color", "#ffffff"),
        text_color: get_str("text_color", "#1a1a1a"),
        accent_color: get_str("accent_color", "#d4af37"),
        font_family: get_str("font_family", "DM Sans"),
        positions,
        text_configs,
        custom_texts,
    })
}

/// Main render function: composites background + text layers + QR code
pub fn render_card(
    theme_config: &CardThemeConfig,
    background_image: Option<&[u8]>,
    qr_image_bytes: &[u8],
    render_data: &std::collections::HashMap<String, String>,
) -> AppResult<Vec<u8>> {
    let width: u32 = 900;
    let height: u32 = 1200;

    // Create background
    let mut canvas = if let Some(bg_bytes) = background_image {
        let bg_img =
            image::load_from_memory(bg_bytes).map_err(|e| AppError::InternalServerError)?;
        let resized = bg_img.resize_to_fill(width, height, image::imageops::FilterType::Lanczos3);
        resized.to_rgba8()
    } else {
        // Solid color background
        let bg_color = parse_color(&theme_config.background_color, (255, 255, 255, 255));
        let mut img = RgbaImage::new(width, height);
        for pixel in img.pixels_mut() {
            *pixel = Rgba([bg_color.0, bg_color.1, bg_color.2, bg_color.3]);
        }
        img
    };

    // Add subtle overlay for readability
    {
        let overlay = Rgba([0, 0, 0, 20]);
        for pixel in canvas.pixels_mut() {
            let r = ((pixel[0] as u16 * 235 + 0 * 20) / 255) as u8;
            let g = ((pixel[1] as u16 * 235 + 0 * 20) / 255) as u8;
            let b = ((pixel[2] as u16 * 235 + 0 * 20) / 255) as u8;
            *pixel = Rgba([r, g, b, 255]);
        }
    }

    // Draw accent border
    let accent_color = parse_color(&theme_config.accent_color, (212, 175, 55, 255));
    draw_rect_border(
        &mut canvas,
        55,
        55,
        width - 110,
        height - 110,
        4,
        accent_color,
    );

    // Render fixed text layers (title, guest, date, venue)
    for (layer_name, position) in &theme_config.positions {
        if layer_name == "qr"
            || layer_name == "icon"
            || layer_name == "frame"
            || layer_name == "polygon"
        {
            continue;
        }

        let text = match layer_name.as_str() {
            "title" => render_data
                .get("EVENT_TITLE")
                .cloned()
                .unwrap_or_else(|| "Event Title".to_string()),
            "guest" => render_data
                .get("GUEST_NAME")
                .cloned()
                .unwrap_or_else(|| "Guest Name".to_string()),
            "date" => render_data
                .get("EVENT_DATE")
                .cloned()
                .unwrap_or_else(|| "Event Date".to_string()),
            "venue" => render_data
                .get("EVENT_VENUE")
                .cloned()
                .unwrap_or_else(|| "Event Venue".to_string()),
            _ => continue,
        };

        if let Some(config) = theme_config.text_configs.get(layer_name) {
            let color_str = if config.color.is_empty() {
                &theme_config.text_color
            } else {
                &config.color
            };
            let color = parse_color(color_str, (26, 26, 26, 255));

            draw_text_on_canvas(
                &mut canvas,
                &text,
                position.0,
                position.1,
                config.font_size,
                &config.font_family,
                color,
                &config.text_align,
                width,
                height,
            );
        }
    }

    // Render custom text layers
    for custom_text in &theme_config.custom_texts {
        if !custom_text.visible {
            continue;
        }

        // Replace variables in content
        let mut content = custom_text.content.clone();
        for (key, value) in render_data {
            content = content.replace(&format!("[{}]", key), value);
        }

        let color_str = if custom_text.color.is_empty() {
            &theme_config.text_color
        } else {
            &custom_text.color
        };
        let color = parse_color(color_str, (26, 26, 26, 255));

        draw_text_on_canvas(
            &mut canvas,
            &content,
            custom_text.x,
            custom_text.y,
            custom_text.font_size,
            &custom_text.font_family,
            color,
            &custom_text.text_align,
            width,
            height,
        );
    }

    // Render QR code
    if let Some((qr_x, qr_y)) = theme_config.positions.get("qr") {
        if !qr_image_bytes.is_empty() {
            if let Ok(qr_img) = image::load_from_memory(qr_image_bytes) {
                let qr_size = 180u32;
                let qr_resized =
                    qr_img.resize_exact(qr_size, qr_size, image::imageops::FilterType::Nearest);

                // Add white background for QR
                let qr_x_px = ((*qr_x / 100.0) * width as f32) as i64 - (qr_size as i64 / 2);
                let qr_y_px = ((*qr_y / 100.0) * height as f32) as i64 - (qr_size as i64 / 2);

                // Draw white padding
                for dy in -10i64..(qr_size as i64 + 10) {
                    for dx in -10i64..(qr_size as i64 + 10) {
                        let px = qr_x_px + dx;
                        let py = qr_y_px + dy;
                        if px >= 0 && py >= 0 && (px as u32) < width && (py as u32) < height {
                            canvas.put_pixel(px as u32, py as u32, Rgba([255, 255, 255, 255]));
                        }
                    }
                }

                image::imageops::overlay(&mut canvas, &qr_resized, qr_x_px, qr_y_px);

                // Draw "SCAN TO CHECK IN" label below QR
                let label_color = parse_color(&theme_config.accent_color, (212, 175, 55, 255));
                draw_text_on_canvas(
                    &mut canvas,
                    "SCAN TO CHECK IN",
                    *qr_x,
                    qr_y + 12.0,
                    14.0,
                    "DM Sans",
                    label_color,
                    "center",
                    width,
                    height,
                );
            }
        }
    }

    // Encode to PNG
    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder
            .write_image(
                canvas.as_raw(),
                width,
                height,
                image::ColorType::Rgba8.into(),
            )
            .map_err(|_| AppError::InternalServerError)?;
    }

    Ok(png_bytes)
}

/// Draw text on canvas at percentage-based position
fn draw_text_on_canvas(
    canvas: &mut RgbaImage,
    text: &str,
    x_percent: f32,
    y_percent: f32,
    font_size: f32,
    font_family: &str,
    color: (u8, u8, u8, u8),
    text_align: &str,
    canvas_width: u32,
    canvas_height: u32,
) {
    let font = load_font(font_family);
    let scale = Scale::uniform(font_size);

    let x = (x_percent / 100.0) * canvas_width as f32;
    let y = (y_percent / 100.0) * canvas_height as f32;

    // Calculate text width for alignment
    let mut text_width = 0.0f32;
    for c in text.chars() {
        let glyph = font.glyph(c).scaled(scale);
        let advance = glyph.h_metrics().advance_width;
        text_width += advance;
    }

    let mut start_x = x;
    match text_align {
        "left" => start_x = x - text_width / 2.0,
        "right" => start_x = x + text_width / 2.0,
        _ => {} // center is default
    }

    // Render character by character
    let mut cursor_x = start_x;
    for c in text.chars() {
        let glyph = font.glyph(c).scaled(scale).positioned(point(cursor_x, y));

        if let Some(bounding_box) = glyph.pixel_bounding_box() {
            glyph.draw(|px, py, v| {
                let pixel_x = bounding_box.min.x + px as i32;
                let pixel_y = bounding_box.min.y + py as i32;

                if pixel_x >= 0
                    && pixel_y >= 0
                    && (pixel_x as u32) < canvas_width
                    && (pixel_y as u32) < canvas_height
                {
                    let alpha = (v * 255.0) as u8;
                    if alpha == 0 {
                        return;
                    }

                    let pixel = canvas.get_pixel_mut(pixel_x as u32, pixel_y as u32);

                    // Alpha blending
                    let bg_r = pixel[0] as f32 / 255.0;
                    let bg_g = pixel[1] as f32 / 255.0;
                    let bg_b = pixel[2] as f32 / 255.0;

                    let fg_a = alpha as f32 / 255.0;
                    let fg_r = color.0 as f32 / 255.0;
                    let fg_g = color.1 as f32 / 255.0;
                    let fg_b = color.2 as f32 / 255.0;

                    let out_r = fg_r * fg_a + bg_r * (1.0 - fg_a);
                    let out_g = fg_g * fg_a + bg_g * (1.0 - fg_a);
                    let out_b = fg_b * fg_a + bg_b * (1.0 - fg_a);

                    pixel[0] = (out_r * 255.0) as u8;
                    pixel[1] = (out_g * 255.0) as u8;
                    pixel[2] = (out_b * 255.0) as u8;
                    pixel[3] = 255;
                }
            });
        }

        cursor_x += glyph.unpositioned().h_metrics().advance_width;
    }
}

/// Draw a rectangle border
fn draw_rect_border(
    canvas: &mut RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    thickness: u32,
    color: (u8, u8, u8, u8),
) {
    let rgba = Rgba([color.0, color.1, color.2, color.3]);

    // Top border
    for dy in 0..thickness {
        for dx in 0..width {
            let px = x + dx;
            let py = y + dy;
            if px < canvas.width() && py < canvas.height() {
                canvas.put_pixel(px, py, rgba);
            }
        }
    }

    // Bottom border
    for dy in 0..thickness {
        for dx in 0..width {
            let px = x + dx;
            let py = y + height - thickness + dy;
            if px < canvas.width() && py < canvas.height() {
                canvas.put_pixel(px, py, rgba);
            }
        }
    }

    // Left border
    for dy in 0..height {
        for dx in 0..thickness {
            let px = x + dx;
            let py = y + dy;
            if px < canvas.width() && py < canvas.height() {
                canvas.put_pixel(px, py, rgba);
            }
        }
    }

    // Right border
    for dy in 0..height {
        for dx in 0..thickness {
            let px = x + width - thickness + dx;
            let py = y + dy;
            if px < canvas.width() && py < canvas.height() {
                canvas.put_pixel(px, py, rgba);
            }
        }
    }
}
