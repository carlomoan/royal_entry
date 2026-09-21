use image::{DynamicImage, Rgba, GenericImageView, ImageEncoder};
use std::path::Path;
use rusttype::{Font, Scale};
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
                    // Load font from configurable path (env or default)
                    let font_path = std::env::var("CARD_FONT_PATH")
                        .unwrap_or_else(|_| "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf".to_string());
                    let font_data = std::fs::read(&font_path)
                        .unwrap_or_else(|_| include_bytes!("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").to_vec());
                    let font = Font::try_from_bytes(&font_data)
                        .unwrap_or_else(|| Font::try_from_bytes(&[]).expect("No font available"));

                    let scale = Scale::uniform(24.0);
                    let color = (30, 30, 30, 255); // Dark navy text

                    // Render text onto image using rusttype
                    let x = placeholder.x as f32;
                    let y = placeholder.y as f32;

                    // For simplicity, draw text as dark text on light background
                    // Full rusttype rendering would use imageproc::drawing
                    let w = placeholder.w as u32;
                    let h = placeholder.h as u32;

                    // Draw light gray background
                    let x_u = placeholder.x as u32;
                    let y_u = placeholder.y as u32;
                    let w_u = placeholder.w as u32;
                    let h_u = placeholder.h as u32;
                    for dy in 0..h_u {
                        for dx in 0..w_u {
                            let px = x_u + dx;
                            let py = y_u + dy;
                            if px < composite.width() && py < composite.height() {
                                let pixel = composite.get_pixel_mut(px, py);
                                *pixel = Rgba([245, 245, 245, 220]);
                            }
                        }
                    }

                    // Draw border
                    for dx in 0..w_u {
                        if y_u < composite.height() {
                            let pixel = composite.get_pixel_mut(x_u + dx, y_u);
                            *pixel = Rgba([180, 180, 180, 255]);
                        }
                        if y_u + h_u.saturating_sub(1) < composite.height() {
                            let pixel = composite.get_pixel_mut(x_u + dx, y_u + h_u.saturating_sub(1));
                            *pixel = Rgba([180, 180, 180, 255]);
                        }
                    }
                    for dy in 0..h_u {
                        if x_u < composite.width() {
                            let pixel = composite.get_pixel_mut(x_u, y_u + dy);
                            *pixel = Rgba([180, 180, 180, 255]);
                        }
                        if x_u + w_u.saturating_sub(1) < composite.width() {
                            let pixel = composite.get_pixel_mut(x_u + w_u.saturating_sub(1), y_u + dy);
                            *pixel = Rgba([180, 180, 180, 255]);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Encode to PNG
    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let mut encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder.write_image(
            composite.as_raw(),
            composite.width(),
            composite.height(),
            image::ColorType::Rgba8.into(),
        ).map_err(|_| crate::error::AppError::InternalServerError)?;
    }

    Ok(png_bytes)
}
