// frontend-next/src/lib/cardTheme.ts

export type LayerType = "text" | "image" | "qr" | "shape" | "divider";
export type TextAlign = "left" | "center" | "right";
export type TextShape = "straight" | "arc-up" | "arc-down" | "circle";

export interface ThemeLayer {
    id: string;
    type: LayerType;
    // Position (percentage-based for responsive scaling)
    x: number;          // 0-100
    y: number;          // 0-100
    width: number;      // 0-100 (for text/image)
    height?: number;    // 0-100
    rotation: number;   // degrees

    // Content
    content: string;    // text content or image URL
    variableBindings: string[]; // e.g., ["GUEST_NAME", "EVENT_DATE"]

    // Styling
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: TextAlign;
    letterSpacing?: number;
    lineHeight?: number;
    textShape?: TextShape;
    arcRadius?: number;

    // Shape/image specific
    shapeType?: "rectangle" | "ellipse" | "star" | "hexagon";
    shapeColor?: string;
    shapeBorder?: string;
    shapeBorderWidth?: number;
    opacity?: number;

    // Visibility
    visible: boolean;
    locked: boolean;
}

export interface RoyalCardTheme {
    id: string;
    name: string;
    description: string;
    category: "wedding" | "corporate" | "birthday" | "general";
    width: number;    // px (design canvas width)
    height: number;   // px (design canvas height)
    background: {
        type: "color" | "image" | "gradient";
        value: string;  // hex color, image URL, or gradient CSS
    };
    layers: ThemeLayer[];
    variables: string[]; // list of required variables
    previewThumbnail?: string;
    createdBy: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

// Default variables available in every theme
export const AVAILABLE_VARIABLES = [
    { key: "GUEST_NAME", label: "Guest Fullname", category: "Guest" },
    { key: "GUEST_SEATNO", label: "Guest SeatNo.", category: "Guest" },
    { key: "GUEST_TABLE", label: "Guest Table No.", category: "Guest" },
    { key: "GUEST_CATEGORY", label: "Guest Type/Class/Level", category: "Guest" },
    { key: "GUEST_PHONE", label: "Guest Phone No.", category: "Guest" },
    { key: "GUEST_EMAIL", label: "Guest Email Address", category: "Guest" },
    { key: "EVENT_TITLE", label: "Event Name/Title", category: "Event" },
    { key: "EVENT_TYPE", label: "Event Type", category: "Event" },
    { key: "EVENT_DATE", label: "Event Date", category: "Event" },
    { key: "EVENT_START_TIME", label: "Event Start Time", category: "Event" },
    { key: "EVENT_END_TIME", label: "Event End Time", category: "Event" },
    { key: "EVENT_REPORTING_TIME", label: "Event Arriving Time", category: "Event" },
    { key: "EVENT_VENUE", label: "Event venue", category: "Event" },
    { key: "EVENT_ADDRESS", label: "Event Venue Address/location", category: "Event" },
    { key: "EVENT_CHARACTERS", label: "Event Main Character/Characters", category: "Event" },
    { key: "EVENT_ORGANISATION_NAME", label: "Family name/Organization name", category: "Event" },
    { key: "QR_CODE", label: "QR Code (Check-in)", category: "System" },
    { key: "CHECKIN_URL", label: "Check-in Link ", category: "System" },
    { key: "SHORT_CODE", label: "SMS Code", category: "System" },
];

// Helper: replace variables in text
export function replaceVariables(text: string, data: Record<string, string>): string {
    let result = text;
    AVAILABLE_VARIABLES.forEach((v) => {
        const regex = new RegExp(`\\[${v.key}\\]`, "g");
        result = result.replace(regex, data[v.key] || `[${v.key}]`);
    });
    return result;
}

// Helper: create a new empty layer
export function createLayer(type: LayerType, x = 50, y = 50): ThemeLayer {
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const base: ThemeLayer = {
        id,
        type,
        x, y,
        width: type === "text" ? 60 : 20,
        height: type === "text" ? 10 : 20,
        rotation: 0,
        content: type === "text" ? "New text" : "",
        variableBindings: [],
        visible: true,
        locked: false,
        opacity: 100,
    };

    if (type === "text") {
        return {
            ...base,
            fontSize: 18,
            fontFamily: "Playfair Display",
            fontWeight: "400",
            color: "#1a1a1a",
            textAlign: "center",
            letterSpacing: 0,
            lineHeight: 1.3,
            textShape: "straight",
            arcRadius: 200,
        };
    }

    if (type === "shape") {
        return {
            ...base,
            shapeType: "rectangle",
            shapeColor: "#d4af37",
            shapeBorder: "transparent",
            shapeBorderWidth: 0,
        };
    }

    if (type === "qr") {
        return { ...base, width: 22, height: 22, content: "QR_CODE" };
    }

    return base;
}