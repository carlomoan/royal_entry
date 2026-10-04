// frontend/src/types/royal-card.ts

export type LayerType = "text" | "image" | "shape" | "qr";
export type TextCurve = "none" | "arc-up" | "arc-down" | "circle";
export type ShapeType = "rectangle" | "ellipse" | "star" | "hexagon" | "line";

export interface ThemeLayer {
    id: string;
    type: LayerType;
    x: number; y: number; w: number; h: number; // 0–100 % of page
    rotation: number;
    opacity: number;             // 0–100
    locked: boolean;
    visible: boolean;
    name?: string;               // Optional layer name for UI

    // text props
    content?: string;            // tokens: {{GUEST_NAME}}
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: "left" | "center" | "right";
    letterSpacing?: number;
    lineHeight?: number;
    curve?: TextCurve;

    // image props
    src?: string;
    fileId?: string;
    fit?: "cover" | "contain";
    radius?: number;

    // shape props
    shapeType?: ShapeType;
    shapeColor?: string;
    shapeBorder?: string;
    shapeBorderWidth?: number;

    // qr props
    qrVariable?: string;         // default "QR_CODE"
}

export interface CardPage {
    id: "front" | "back" | string;
    name: string;
    background: {
        type: "color" | "image";
        value: string;             // hex or uploaded file URL
        fileId?: string;
        overlay?: string;          // e.g. "rgba(255,248,235,0.35)"
    };
    layers: ThemeLayer[];
}

export interface RoyalCardTheme {
    version: 2;
    id: string;
    name: string;
    description: string;
    category: "wedding" | "graduation" | "corporate" | "birthday" | "other";
    size: { width: number; height: number };        // px, portrait 3:4
    variables: string[];                            // which vars this theme uses
    pages: CardPage[];                              // [front, back]
    createdBy?: string;
    isPublic?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export const CARD_VARIABLES = [
    { key: "GUEST_NAME", label: "Guest Fullname", category: "Guest" },
    { key: "GUEST_SEATNO", label: "Seat No.", category: "Guest" },
    { key: "GUEST_TABLE", label: "Table No.", category: "Guest" },
    { key: "GUEST_CATEGORY", label: "Guest Type", category: "Guest" },
    { key: "EVENT_TITLE", label: "Event Title", category: "Event" },
    { key: "EVENT_TYPE", label: "Event Type", category: "Event" },
    { key: "EVENT_DATE", label: "Event Date (Swahili)", category: "Event" },
    { key: "EVENT_CHARACTERS", label: "Couple / Main Characters", category: "Event" },
    { key: "EVENT_VENUE", label: "Venue", category: "Event" },
    { key: "EVENT_ADDRESS", label: "Venue Address", category: "Event" },
    { key: "EVENT_START_TIME", label: "Start Time", category: "Event" },
    { key: "QR_CODE", label: "Check-in QR Payload", category: "System" },
] as const;

// Helper: create an empty v2 theme
export function emptyTheme(): RoyalCardTheme {
    return {
        version: 2,
        id: "",
        name: "Untitled Theme",
        description: "",
        category: "wedding",
        size: { width: 900, height: 1200 },
        variables: [],
        pages: [
            {
                id: "front",
                name: "Invitation",
                background: { type: "color", value: "#FBF6EA" },
                layers: [],
            },
        ],
        createdBy: "me",
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// Helper: normalize raw DB JSON into a valid v2 theme
export function normalizeTheme(raw: any): RoyalCardTheme {
    const base = raw.version === 2 ? raw : { ...raw, version: 2 };
    if (!base.pages || !Array.isArray(base.pages) || base.pages.length === 0) {
        base.pages = [{ id: "front", name: "Invitation", background: { type: "color", value: "#FBF6EA" }, layers: [] }];
    }
    if (!base.size) base.size = { width: 900, height: 1200 };
    if (!base.variables) base.variables = [];
    return base as RoyalCardTheme;
}

// Helper: collect all unique variable keys used across all pages/layers
export function collectVariables(theme: RoyalCardTheme): string[] {
    const keys = new Set<string>();
    theme.pages.forEach((page) =>
        page.layers.forEach((layer) => {
            if (layer.content) {
                const matches = layer.content.match(/\{\{(\w+)\}\}/g);
                matches?.forEach((m) => keys.add(m.replace(/[{}]/g, "")));
            }
            if (layer.qrVariable) keys.add(layer.qrVariable);
        })
    );
    return Array.from(keys);
}