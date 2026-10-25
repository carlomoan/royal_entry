// src/components/cards/RoyalCard.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Rnd } from "react-rnd";
import api from "@/lib/api";
import { CardTemplateRecord, QrPosition, clampQrPosition } from "@/types/cardTheme";

interface RoyalCardProps {
    template: CardTemplateRecord;
    qrPayload: string;
    width?: number;
    /**
     * Controlled QR placement in percentages (0–100 of the design).
     * When omitted, the template's stored `theme_config.qr_position` is used.
     */
    qrPosition?: QrPosition;
    /** Called with the new placement while dragging/resizing in editable mode. */
    onPositionChange?: (position: QrPosition) => void;
    /** Renders the QR overlay as a draggable/resizable box for fine-tuning. */
    editable?: boolean;
}

function useFileImage(fileId?: string | null): { url: string | null; failed: boolean } {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;
        setUrl(null);
        setFailed(false);
        if (!fileId) return;

        api.get(`/files/${encodeURIComponent(fileId)}`, { responseType: "blob" })
            .then((response) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(response.data);
                setUrl(objectUrl);
            })
            .catch(() => { if (!cancelled) setFailed(true); });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [fileId]);

    return { url, failed };
}

export function RoyalCard({
    template,
    qrPayload,
    width = 600,
    qrPosition,
    onPositionChange,
    editable = false,
}: RoyalCardProps) {
    const [qrDataUrl, setQrDataUrl] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

    const fileId = template.theme_config?.front_file_id ?? template.background_file_id;
    const { url: bgUrl, failed: bgFailed } = useFileImage(fileId);

    // QR stamps use percentages of the rendered design, matching the studio.
    const qrPos = qrPosition ?? clampQrPosition(template.theme_config?.qr_position);

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

    // Track the rendered canvas size so drag/resize coordinates map to percentages.
    useEffect(() => {
        if (!editable) return;
        const el = containerRef.current;
        if (!el) return;
        const measure = () => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [editable, bgUrl]);

    return (
        <div
            ref={containerRef}
            className="relative shadow-2xl mx-auto overflow-hidden rounded-lg"
            style={{ width, touchAction: "none" }}
        >
            {bgUrl ? (
                <>
                    {/* Base Design Image */}
                    <img
                        src={bgUrl}
                        alt="Invitation Design"
                        className="w-full h-auto block"
                    />

                    {/* Stamped QR Code Overlay */}
                    {qrDataUrl && (
                        editable && containerSize.w > 0 ? (
                            <Rnd
                                size={{ width: `${qrPos.w}%`, height: `${qrPos.h}%` }}
                                position={{
                                    x: (qrPos.x / 100) * containerSize.w,
                                    y: (qrPos.y / 100) * containerSize.h,
                                }}
                                bounds="parent"
                                onDragStop={(_, d) => {
                                    const parent = d.node.parentNode as HTMLElement;
                                    if (!parent) return;
                                    const x = Math.max(0, Math.min(100 - qrPos.w, (d.x / parent.offsetWidth) * 100));
                                    const y = Math.max(0, Math.min(100 - qrPos.h, (d.y / parent.offsetHeight) * 100));
                                    onPositionChange?.({ ...qrPos, x, y });
                                }}
                                onResizeStop={(_, __, ref) => {
                                    const parent = ref.parentNode as HTMLElement;
                                    if (!parent) return;
                                    const w = Math.max(5, Math.min(50, (ref.offsetWidth / parent.offsetWidth) * 100));
                                    const h = Math.max(5, Math.min(50, (ref.offsetHeight / parent.offsetHeight) * 100));
                                    const x = Math.min(qrPos.x, 100 - w);
                                    const y = Math.min(qrPos.y, 100 - h);
                                    onPositionChange?.({ x, y, w, h });
                                }}
                                className="border-2 border-dashed border-gold-500 z-10"
                                style={{ minWidth: "40px", minHeight: "40px" }}
                            >
                                <img
                                    src={qrDataUrl}
                                    alt="Check-in QR"
                                    className="w-full h-full pointer-events-none"
                                />
                            </Rnd>
                        ) : (
                            <img
                                src={qrDataUrl}
                                alt="Check-in QR"
                                className="absolute pointer-events-none"
                                style={{
                                    left: `${qrPos.x}%`,
                                    top: `${qrPos.y}%`,
                                    width: `${qrPos.w}%`,
                                    height: `${qrPos.h}%`,
                                }}
                            />
                        )
                    )}
                </>
            ) : (
                <div className="aspect-[3/4] bg-slate-100 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-slate-500">
                        {bgFailed ? "Background unavailable" : "Loading design…"}
                    </p>
                </div>
            )}
        </div>
    );
}