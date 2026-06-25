import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrCodeImageProps = {
  value?: string;
  size?: number;
  className?: string;
  alt?: string;
};

export default function QrCodeImage({
  value,
  size = 220,
  className,
  alt = "QR code",
}: QrCodeImageProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setSrc("");
      return;
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url: string) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!value) {
    return (
      <div
        className={`flex items-center justify-center rounded-[28px] bg-slate-100 text-center text-sm text-slate-400 ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        QR will appear after invitation generation
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`animate-pulse rounded-[28px] bg-slate-200 ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img src={src} alt={alt} width={size} height={size} className={className} />
  );
}
