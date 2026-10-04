// In frontend/src/components/cards/RoyalCard.tsx

function RenderLayer({ layer, data }: { layer: ThemeLayer; data: Record<string, string> }) {
    if (!layer.visible) return null;

    const baseStyle: React.CSSProperties = {
        position: "absolute",
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.w}%`,
        height: `${layer.h}%`,
        transform: `rotate(${layer.rotation}deg)`,
        opacity: layer.opacity / 100,
    };

    // IMAGE LAYER
    if (layer.type === "image" && layer.src) {
        return (
            <img
                src={layer.src}
                alt=""
                draggable={false}
                className="pointer-events-none select-none"
                style={{ ...baseStyle, objectFit: layer.fit ?? "cover", borderRadius: layer.radius ?? 0, width: "100%", height: "100%" }}
            />
        );
    }

    // SHAPE LAYER
    if (layer.type === "shape") {
        return (
            <div style={{
                ...baseStyle, width: "100%", height: "100%",
                backgroundColor: layer.shapeColor,
                border: `${layer.shapeBorderWidth ?? 0}px solid ${layer.shapeBorder ?? "transparent"}`,
                borderRadius: layer.shapeType === "ellipse" ? "50%" : 0,
                clipPath: layer.shapeType === "star"
                    ? "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"
                    : layer.shapeType === "hexagon"
                        ? "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)" : undefined,
            }} />
        );
    }

    // QR CODE LAYER
    if (layer.type === "qr") {
        const payload = data[layer.qrVariable ?? "QR_CODE"] ?? "https://royalentry.co.tz";
        const [src, setSrc] = useState("");

        useEffect(() => {
            QRCode.toDataURL(payload, { margin: 1, width: 512, color: { dark: "#1a1a1a", light: "#ffffff" } })
                .then(setSrc).catch(console.error);
        }, [payload]);

        return (
            <div style={{
                ...baseStyle, width: "100%", height: "100%", background: "#fff",
                border: "3px solid #B88952", borderRadius: 14, padding: "4.5%",
                display: "flex", alignItems: "center", justifyContent: "center"
            }}>
                {src && <img src={src} style={{ width: "100%", height: "100%" }} alt="QR" />}
            </div>
        );
    }

    // TEXT LAYER (Fixed SVG Props)
    const content = replaceTokens(layer.content ?? "", data);

    // ✅ FIX: Bundle all CSS properties into a single 'style' object
    const textStyle: React.CSSProperties = {
        fontSize: layer.fontSize,
        fontFamily: layer.fontFamily,
        fontWeight: layer.fontWeight,
        color: layer.color,
        textAlign: layer.textAlign ?? "center",
        letterSpacing: layer.letterSpacing,
        lineHeight: layer.lineHeight,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        width: "100%",
    };

    if (!layer.curve || layer.curve === "none") {
        return <div style={{ ...baseStyle, ...textStyle }}>{content}</div>;
    }

    // Curved Text via SVG textPath
    const r = 100;
    const d = layer.curve === "arc-up" ? `M 0 ${r} A ${r} ${r} 0 0 1 ${r * 2} ${r}`
        : layer.curve === "arc-down" ? `M 0 ${r} A ${r} ${r} 0 0 0 ${r * 2} ${r}`
            : `M ${r} 0 A ${r} ${r} 0 1 1 ${r} 0.01`;

    return (
        <svg style={{ ...baseStyle, overflow: "visible" }} width="100%" height="100%" viewBox={`0 0 ${r * 2} ${r * 2}`}>
            <defs><path id={`c-${layer.id}`} d={d} fill="none" /></defs>
            {/* ✅ FIX: Pass textStyle via the 'style' prop, not as direct attributes */}
            <text style={textStyle} fill={layer.color} textAnchor="middle">
                <textPath href={`#c-${layer.id}`} startOffset="50%">{content}</textPath>
            </text>
        </svg>
    );
}