use qrcode::QrCode;
use image::{Luma, ImageEncoder};

pub fn render_qr_png(link: &str) -> Result<Vec<u8>, crate::error::AppError> {
    let code = QrCode::new(link.as_bytes())
        .map_err(|_| crate::error::AppError::InternalServerError)?;

    let image = code.render::<Luma<u8>>()
        .min_dimensions(300, 300)
        .build();

    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder.write_image(
            &image,
            image.width(),
            image.height(),
            image::ColorType::L8.into(),
        ).map_err(|_| crate::error::AppError::InternalServerError)?;
    }

    Ok(png_bytes)
}
