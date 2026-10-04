// frontend-next/src/components/ThemeSelector.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Palette, Check, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { Button, Card, Badge, Modal } from "@/components/ui";
import { RoyalCardTheme } from "@/lib/cardTheme";

interface ThemeSelectorProps {
    eventId: string;
    currentThemeId?: string;
    onSelect: (themeId: string) => void;
}

export function ThemeSelector({ eventId, currentThemeId, onSelect }: ThemeSelectorProps) {
    const [open, setOpen] = useState(false);

    const { data: themes = [] } = useQuery({
        queryKey: ["card-themes"],
        queryFn: async () => (await api.get("/cards/templates")).data.data ?? [],
    });

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Palette className="h-4 w-4 mr-1" /> Change Card Theme
            </Button>

            <Modal isOpen={open} onClose={() => setOpen(false)} title="Select Card Theme" size="lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {themes.map((t: any) => {
                        const config = t.theme_config || {};
                        const isSelected = currentThemeId === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => { onSelect(t.id); setOpen(false); }}
                                className={`relative p-4 rounded-lg border text-left transition ${isSelected ? "border-gold-500 ring-2 ring-gold-200" : "border-slate-200 hover:border-gold-300"
                                    }`}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 bg-gold-500 rounded-full p-1">
                                        <Check className="h-3 w-3 text-white" />
                                    </div>
                                )}
                                <div
                                    className="h-32 rounded mb-2 flex items-center justify-center"
                                    style={{ backgroundColor: config.background?.value || "#FEF7ED" }}
                                >
                                    <Sparkles className="h-8 w-8 text-white/50" />
                                </div>
                                <p className="font-semibold text-sm">{t.name}</p>
                                <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                                <div className="mt-2 flex gap-1">
                                    <Badge label={`${config.layers?.length || 0} layers`} variant="slate" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Modal>
        </>
    );
}