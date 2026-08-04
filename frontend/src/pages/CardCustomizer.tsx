// ==============================================================================
// FILE: src/pages/CardCustomizer.tsx
// ==============================================================================
// Full-page wrapper for the Invitation Card Template Customizer.

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Wand2 } from "lucide-react";
import CardCustomizer from "@/components/card-customizer/CardCustomizer";

export default function CardCustomizerPage() {
  const { id: eventId } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {eventId && (
            <Link
              to={`/events/${eventId}/cards`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Card Studio
            </Link>
          )}
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Invitation Card Customizer
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Design your invitation from scratch or start with a template. Drag,
            resize, rotate elements, inject flowers and graphics, control
            typography and background, then export as PNG or PDF.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50/60 px-4 py-2.5 text-xs font-semibold text-gold-700">
          <Wand2 className="h-4 w-4" />
          Interactive canvas editor
        </div>
      </div>

      <CardCustomizer />
    </div>
  );
}
