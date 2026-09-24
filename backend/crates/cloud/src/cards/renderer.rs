use image::{DynamicImage, Rgba, ImageEncoder};
use std::path::Path;
use rusttype::{Font, Scale, point};
use crate::cards::model::CardPlaceholder;

pub fn composite_card(
    background_path: Option<&Path>,
    qr_image_bytes: Vec<u8>,
    placeholders: Vec<CardPlaceholder>,
    background_file_id: Option<String>,
) -> Result<Vec<u8>, crate::error::AppError> {
    // Load background (default white if none provided)
    let background = if let Some(path) = background_path {
        image::open(path).map_err(|_| crate::error::AppError::InternalServerError)?
    } else {
        DynamicImage::new_rgba8(800, 600)
    };

    let mut composite = background.to_rgba8();

    // Process each placeholder
    for placeholder in placeholders {
        match placeholder.placeholder_type.as_str() {
            "qr" => {
                // Load and resize QR
                let qr_image = image::load_from_memory(&qr_image_bytes)
                    .map_err(|_| crate::error::AppError::InternalServerError)?;
                let qr_resized = qr_image.resize(
                    placeholder.w as u32,
                    placeholder.h as u32,
                    image::imageops::FilterType::Lanczos3,
                );
                image::imageops::overlay(
                    &mut composite,
                    &qr_resized,
                    placeholder.x as i64,
                    placeholder.y as i64,
                );
            }
            "text" => {
                if let Some(text_content) = placeholder.text_content.as_ref() {
                    // Load font from configurable path
                    let font_path = std::env::var("CARD_FONT_PATH")
                        .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf".to_string());

                    let font_data = std::fs::read(&font_path)
                        .unwrap_or_else(|_| {
                            // Fallback to embedded font or empty
                            include_bytes!("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").to_vec()
                        });

                    let font = Font::try_from_bytes(&font_data)
                        .unwrap_or_else(|| Font::try_from_bytes(&[]).expect("No font available"));

                    let scale = Scale::uniform(24.0);
                    let color = (30, 30, 30, 255); // Dark navy text

                    let x = placeholder.x as f32;
                    let y = placeholder.y as f32;

                    // Render text character by character
                    let mut cursor_x = x;
                    for c in text_content.chars() {
                        let glyph = font.glyph(c).scaled(scale).positioned(point(cursor_x, y));

                        if let Some(bounding_box) = glyph.pixel_bounding_box() {
                            glyph.draw(|px, py, v| {
                                let pixel_x = bounding_box.min.x + px as i32;
                                let pixel_y = bounding_box.min.y + py as i32;

                                if pixel_x >= 0
                                    && pixel_y >= 0
                                    && (pixel_x as u32) < composite.width()
                                    && (pixel_y as u32) < composite.height()
                                {
                                    let alpha = (v * 255.0) as u8;
                                    let pixel = composite.get_pixel_mut(pixel_x as u32, pixel_y as u32);

                                    // Alpha blending
                                    let bg_r = pixel[0] as f32;
                                    let bg_g = pixel[1] as f32;
                                    let bg_b = pixel[2] as f32;
                                    let bg_a = pixel[3] as f32 / 255.0;

                                    let fg_a = alpha as f32 / 255.0;
                                    let out_a = fg_a + bg_a * (1.0 - fg_a);

                                    if out_a > 0.0 {
                                        pixel[0] = ((color.0 as f32 * fg_a + bg_r * bg_a * (1.0 - fg_a)) / out_a) as u8;
                                        pixel[1] = ((color.1 as f32 * fg_a + bg_g * bg_a * (1.0 - fg_a)) / out_a) as u8;
                                        pixel[2] = ((color.2 as f32 * fg_a + bg_b * bg_a * (1.0 - fg_a)) / out_a) as u8;
                                        pixel[3] = (out_a * 255.0) as u8;
                                    }
                                }
                            });
                        }

                        // Advance cursor
                        cursor_x += glyph.unpositioned().h_metrics().advance_width;
                    }
                }
            }
            _ => {}
        }
    }

    // Encode to PNG
    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder.write_image(
            composite.as_raw(),
            composite.width(),
            composite.height(),
            image::ColorType::Rgba8.into(),
        ).map_err(|_| crate::error::AppError::InternalServerError)?;
    }

    Ok(png_bytes)
}
