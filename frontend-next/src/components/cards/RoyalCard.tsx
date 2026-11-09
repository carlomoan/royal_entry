// src/components/cards/RoyalCard.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Rnd } from "react-rnd";
import api from "@/lib/api";
import {
  CardTemplateRecord, QrPosition,
  clampQrPosition, clampNamePosition,
} from "@/types/cardTheme";

interface RoyalCardProps {
    template: CardTemplateRecord;
    qrPayload: string;
    width?: number;
    /** Guest full name stamped on the card (rendered at guest_name_position). */
    guestName?: string;
    /**
     * Controlled QR placement in percentages (0–100 of the design).
     * When omitted, the template's stored `theme_config.qr_position` is used.
     */
    qrPosition?: QrPosition;
    /** Called with the new placement while dragging/resizing in editable mode. */
    onPositionChange?: (position: QrPosition) => void;
    /** Controlled guest-name box placement. */
    namePosition?: QrPosition;
    onNamePositionChange?: (position: QrPosition) => void;
    /** Renders the QR + name overlays as draggable/resizable boxes. */
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

/** Visible corner resize handles for react-rnd boxes. */
function cornerHandles(color: string) {
    const handle = {
        width: 14,
        height: 14,
        background: color,
        borderRadius: 4,
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
    };
    return {
        topLeft: { ...handle, top: -7, left: -7 },
        topRight: { ...handle, top: -7, right: -7 },
        bottomLeft: { ...handle, bottom: -7, left: -7 },
        bottomRight: { ...handle, bottom: -7, right: -7 },
    };
}

export function RoyalCard({
    template,
    qrPayload,
    width = 600,
    guestName,
    qrPosition,
    onPositionChange,
    namePosition,
    onNamePositionChange,
    editable = false,
}: RoyalCardProps) {
    const [qrDataUrl, setQrDataUrl] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

    const fileId = template.theme_config?.front_file_id ?? template.background_file_id;
    const { url: bgUrl, failed: bgFailed } = useFileImage(fileId);

    // QR stamps use percentages of the rendered design, matching the studio.
    const qrPos = qrPosition ?? clampQrPosition(template.theme_config?.qr_position);
    const namePos = namePosition ?? clampNamePosition(template.theme_config?.guest_name_position);

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
        const el = containerRef.current;
        if (!el) return;
        const measure = () => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [bgUrl]);

    // Guest-name font size scales with the box height (matches the backend render).
    const nameFontSize = containerSize.h > 0 ? Math.max(10, (namePos.h / 100) * containerSize.h * 0.8) : 16;

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

                    {/* Guest name overlay */}
                    {guestName && (editable && containerSize.w > 0 ? (
                        <Rnd
                            size={{ width: `${namePos.w}%`, height: `${namePos.h}%` }}
                            position={{
                                x: (namePos.x / 100) * containerSize.w,
                                y: (namePos.y / 100) * containerSize.h,
                            }}
                            bounds="parent"
                            onDragStop={(_, d) => {
                                const parent = d.node.parentNode as HTMLElement;
                                if (!parent) return;
                                const x = Math.max(0, Math.min(100 - namePos.w, (d.x / parent.offsetWidth) * 100));
                                const y = Math.max(0, Math.min(100 - namePos.h, (d.y / parent.offsetHeight) * 100));
                                onNamePositionChange?.({ ...namePos, x, y });
                            }}
                            onResizeStop={(_, __, ref) => {
                                const parent = ref.parentNode as HTMLElement;
                                if (!parent) return;
                                const w = Math.max(10, Math.min(90, (ref.offsetWidth / parent.offsetWidth) * 100));
                                const h = Math.max(3, Math.min(30, (ref.offsetHeight / parent.offsetHeight) * 100));
                                const x = Math.min(namePos.x, 100 - w);
                                const y = Math.min(namePos.y, 100 - h);
                                onNamePositionChange?.({ x, y, w, h });
                            }}
                            className="border-2 border-dashed border-sky-500 bg-sky-500/10 z-10"
                            style={{ minWidth: "80px", minHeight: "24px" }}
                            resizeHandleStyles={cornerHandles("#0ea5e9")}
                        >
                            <div className="w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
                                <span
                                    className="truncate font-semibold text-white"
                                    style={{
                                        fontSize: nameFontSize,
                                        textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
                                    }}
                                >
                                    {guestName}
                                </span>
                            </div>
                        </Rnd>
                    ) : (
                        guestName && (
                            <div
                                className="absolute pointer-events-none flex items-center justify-center overflow-hidden"
                                style={{
                                    left: `${namePos.x}%`,
                                    top: `${namePos.y}%`,
                                    width: `${namePos.w}%`,
                                    height: `${namePos.h}%`,
                                }}
                            >
                                <span
                                    className="truncate font-semibold text-white"
                                    style={{
                                        fontSize: nameFontSize,
                                        textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
                                    }}
                                >
                                    {guestName}
                                </span>
                            </div>
                        )
                    ))}

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
                                lockAspectRatio
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
                                    const side = Math.max(5, Math.min(50, (ref.offsetWidth / parent.offsetWidth) * 100));
                                    const x = Math.min(qrPos.x, 100 - side);
                                    const y = Math.min(qrPos.y, 100 - side);
                                    onPositionChange?.({ x, y, w: side, h: side });
                                }}
                                className="border-2 border-dashed border-gold-500 z-10"
                                style={{ minWidth: "40px", minHeight: "40px" }}
                                resizeHandleStyles={cornerHandles("#c9a84c")}
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