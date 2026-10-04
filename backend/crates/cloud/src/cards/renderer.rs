use crate::error::{AppError, AppResult};
use image::{ImageEncoder, Rgba, RgbaImage};
use rusttype::{point, Font, Scale};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct CardThemeConfig {
    pub version: i32,
    pub size: (u32, u32),
    pub background: ThemeBackground,
    pub pages: Vec<ThemePage>,
}

#[derive(Debug, Clone)]
pub struct ThemeBackground {
    pub r#type: String,
    pub value: String,
    pub overlay: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ThemePage {
    pub id: String,
    pub name: String,
    pub background: ThemeBackground,
    pub layers: Vec<ThemeLayer>,
}

#[derive(Debug, Clone)]
pub struct ThemeLayer {
    pub id: String,
    pub r#type: String,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub rotation: f32,
    pub opacity: f32,
    pub visible: bool,
    pub content: Option<String>,
    pub font_size: Option<f32>,
    pub font_family: Option<String>,
    pub font_weight: Option<String>,
    pub color: Option<String>,
    pub text_align: Option<String>,
    pub letter_spacing: Option<f32>,
    pub line_height: Option<f32>,
    pub curve: Option<String>,
    pub src: Option<String>,
    pub fit: Option<String>,
    pub radius: Option<f32>,
    pub shape_type: Option<String>,
    pub shape_color: Option<String>,
    pub shape_border: Option<String>,
    pub shape_border_width: Option<f32>,
    pub qr_variable: Option<String>,
}

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

fn load_font(font_family: &str) -> Font<'static> {
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
    if let Ok(font_data) = std::fs::read(&font_path) {
        if let Some(font) = Font::try_from_vec(font_data) {
            return font;
        }
    }
    panic!("No font file found. Set CARD_FONT_PATH or install DejaVu fonts.")
}

pub fn parse_theme_config(config: &Value) -> AppResult<CardThemeConfig> {
    let obj = config.as_object().ok_or_else(|| {
        AppError::BadRequest("Invalid theme_config: expected JSON object".to_string())
    })?;

    let version = obj.get("version").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let size = if let Some(size_obj) = obj.get("size").and_then(|v| v.as_object()) {
        (
            size_obj
                .get("width")
                .and_then(|v| v.as_f64())
                .unwrap_or(900.0) as u32,
            size_obj
                .get("height")
                .and_then(|v| v.as_f64())
                .unwrap_or(1200.0) as u32,
        )
    } else {
        (900, 1200)
    };

    let background = if let Some(bg) = obj.get("background").and_then(|v| v.as_object()) {
        ThemeBackground {
            r#type: bg
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("color")
                .to_string(),
            value: bg
                .get("value")
                .and_then(|v| v.as_str())
                .unwrap_or("#ffffff")
                .to_string(),
            overlay: bg
                .get("overlay")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        }
    } else {
        ThemeBackground {
            r#type: "color".to_string(),
            value: "#ffffff".to_string(),
            overlay: None,
        }
    };

    let pages = if let Some(pages_arr) = obj.get("pages").and_then(|v| v.as_array()) {
        pages_arr
            .iter()
            .filter_map(|page_val| {
                let page = page_val.as_object()?;
                let bg = page
                    .get("background")
                    .and_then(|v| v.as_object())
                    .map(|b| ThemeBackground {
                        r#type: b
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("color")
                            .to_string(),
                        value: b
                            .get("value")
                            .and_then(|v| v.as_str())
                            .unwrap_or("#ffffff")
                            .to_string(),
                        overlay: b
                            .get("overlay")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                    })
                    .unwrap_or_else(|| background.clone());

                let layers = page
                    .get("layers")
                    .and_then(|v| v.as_array())
                    .map(|layers_arr| {
                        layers_arr
                            .iter()
                            .filter_map(|layer_val| {
                                let l = layer_val.as_object()?;
                                Some(ThemeLayer {
                                    id: l
                                        .get("id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string(),
                                    r#type: l
                                        .get("type")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("text")
                                        .to_string(),
                                    x: l.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                                    y: l.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                                    w: l.get("w").and_then(|v| v.as_f64()).unwrap_or(10.0) as f32,
                                    h: l.get("h").and_then(|v| v.as_f64()).unwrap_or(10.0) as f32,
                                    rotation: l
                                        .get("rotation")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0)
                                        as f32,
                                    opacity: l
                                        .get("opacity")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(100.0)
                                        as f32,
                                    visible: l
                                        .get("visible")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(true),
                                    content: l
                                        .get("content")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    font_size: l
                                        .get("fontSize")
                                        .and_then(|v| v.as_f64())
                                        .map(|v| v as f32),
                                    font_family: l
                                        .get("fontFamily")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    font_weight: l
                                        .get("fontWeight")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    color: l
                                        .get("color")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    text_align: l
                                        .get("textAlign")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    letter_spacing: l
                                        .get("letterSpacing")
                                        .and_then(|v| v.as_f64())
                                        .map(|v| v as f32),
                                    line_height: l
                                        .get("lineHeight")
                                        .and_then(|v| v.as_f64())
                                        .map(|v| v as f32),
                                    curve: l
                                        .get("curve")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    src: l
                                        .get("src")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    fit: l
                                        .get("fit")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    radius: l
                                        .get("radius")
                                        .and_then(|v| v.as_f64())
                                        .map(|v| v as f32),
                                    shape_type: l
                                        .get("shapeType")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    shape_color: l
                                        .get("shapeColor")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    shape_border: l
                                        .get("shapeBorder")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    shape_border_width: l
                                        .get("shapeBorderWidth")
                                        .and_then(|v| v.as_f64())
                                        .map(|v| v as f32),
                                    qr_variable: l
                                        .get("qrVariable")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                Some(ThemePage {
                    id: page
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("front")
                        .to_string(),
                    name: page
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Page")
                        .to_string(),
                    background: bg,
                    layers,
                })
            })
            .collect()
    } else {
        vec![ThemePage {
            id: "front".to_string(),
            name: "Front".to_string(),
            background: background.clone(),
            layers: vec![],
        }]
    };

    Ok(CardThemeConfig {
        version,
        size,
        background,
        pages,
    })
}

pub fn render_card(
    theme_config: &CardThemeConfig,
    _background_image: Option<&[u8]>,
    _qr_image_bytes: &[u8],
    render_data: &HashMap<String, String>,
) -> AppResult<Vec<u8>> {
    let (width, height) = theme_config.size;
    let mut final_images = Vec::new();

    for page in &theme_config.pages {
        let mut canvas = if page.background.r#type == "color" {
            let bg_color = parse_color(&page.background.value, (255, 255, 255, 255));
            let mut img = RgbaImage::new(width, height);
            for pixel in img.pixels_mut() {
                *pixel = Rgba([bg_color.0, bg_color.1, bg_color.2, bg_color.3]);
            }
            img
        } else {
            let mut img = RgbaImage::new(width, height);
            for pixel in img.pixels_mut() {
                *pixel = Rgba([255, 255, 255, 255]);
            }
            img
        };

        if let Some(overlay) = &page.background.overlay {
            let ov_color = parse_color(overlay, (0, 0, 0, 0));
            if ov_color.3 > 0 {
                for pixel in canvas.pixels_mut() {
                    let bg_r = pixel[0] as f32 / 255.0;
                    let bg_g = pixel[1] as f32 / 255.0;
                    let bg_b = pixel[2] as f32 / 255.0;
                    let fg_a = ov_color.3 as f32 / 255.0;
                    let fg_r = ov_color.0 as f32 / 255.0;
                    let fg_g = ov_color.1 as f32 / 255.0;
                    let fg_b = ov_color.2 as f32 / 255.0;
                    pixel[0] = ((fg_r * fg_a + bg_r * (1.0 - fg_a)) * 255.0) as u8;
                    pixel[1] = ((fg_g * fg_a + bg_g * (1.0 - fg_a)) * 255.0) as u8;
                    pixel[2] = ((fg_b * fg_a + bg_b * (1.0 - fg_a)) * 255.0) as u8;
                }
            }
        }

        for layer in &page.layers {
            if !layer.visible {
                continue;
            }
            if layer.r#type == "text" {
                if let Some(content) = &layer.content {
                    let mut text = content.clone();
                    for (key, value) in render_data {
                        text = text.replace(&format!("{{{{{}}}}}", key), value);
                    }
                    let color_str = layer.color.as_deref().unwrap_or("#000000");
                    let color = parse_color(color_str, (0, 0, 0, 255));
                    let font_family = layer.font_family.as_deref().unwrap_or("DM Sans");
                    draw_text_on_canvas(
                        &mut canvas,
                        &text,
                        layer.x,
                        layer.y,
                        layer.font_size.unwrap_or(16.0),
                        font_family,
                        color,
                        layer.text_align.as_deref().unwrap_or("center"),
                        width,
                        height,
                    );
                }
            }
        }

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
        final_images.extend(png_bytes);
    }
    Ok(final_images)
}

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

    let mut text_width = 0.0f32;
    for c in text.chars() {
        text_width += font.glyph(c).scaled(scale).h_metrics().advance_width;
    }

    let mut start_x = x;
    match text_align {
        "left" => start_x = x - text_width / 2.0,
        "right" => start_x = x + text_width / 2.0,
        _ => {}
    }

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
                    let bg_r = pixel[0] as f32 / 255.0;
                    let bg_g = pixel[1] as f32 / 255.0;
                    let bg_b = pixel[2] as f32 / 255.0;
                    let fg_a = alpha as f32 / 255.0;
                    let fg_r = color.0 as f32 / 255.0;
                    let fg_g = color.1 as f32 / 255.0;
                    let fg_b = color.2 as f32 / 255.0;
                    pixel[0] = ((fg_r * fg_a + bg_r * (1.0 - fg_a)) * 255.0) as u8;
                    pixel[1] = ((fg_g * fg_a + bg_g * (1.0 - fg_a)) * 255.0) as u8;
                    pixel[2] = ((fg_b * fg_a + bg_b * (1.0 - fg_a)) * 255.0) as u8;
                    pixel[3] = 255;
                }
            });
        }
        cursor_x += glyph.unpositioned().h_metrics().advance_width;
    }
}
