// src/components/cards/RoyalCard.tsx
"use client";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { CardTemplateConfig } from "@/types/cardTheme";

interface RoyalCardProps {
    template: CardTemplateConfig;
    qrPayload: string;
    width?: number;
}

export function RoyalCard({ template, qrPayload, width = 600 }: RoyalCardProps) {
    const [qrDataUrl, setQrDataUrl] = useState("");

    useEffect(() => {
        if (qrPayload) {
            QRCode.toDataURL(qrPayload, {
                margin: 0,
                width: 512,
                color: { dark: "#000000", light: "#ffffff00" } // Transparent background
            })
                .then(setQrDataUrl)
                .catch(console.error);
        }
    }, [qrPayload]);

    return (
        <div className="relative shadow-2xl mx-auto" style={{ width, aspectRatio: "3/4" }}>
            {/* Base Design Image */}
            <img
                src={template.front_image_url}
                alt="Invitation Design"
                className="w-full h-full object-cover rounded-lg"
            />

            {/* Stamped QR Code Overlay */}
            {qrDataUrl && (
                <img
                    src={qrDataUrl}
                    alt="Check-in QR"
                    className="absolute pointer-events-none"
                    style={{
                        left: `${template.qr_position.x}%`,
                        top: `${template.qr_position.y}%`,
                        width: `${template.qr_position.w}%`,
                        height: `${template.qr_position.h}%`,
                    }}
                />
            )}
        </div>
    );
}