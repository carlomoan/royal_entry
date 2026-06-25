import Badge from "@/components/ui/Badge";
import QrCodeImage from "@/components/ui/QrCodeImage";
import { formatDate } from "@/utils/format";
import { getTemplate, type CardTemplate } from "@/data/cardTemplates";

type InvitationCardPreviewProps = {
  theme?: string;
  event: {
    title: string;
    event_date: string;
    event_time?: string;
    venue_name?: string;
    venue_address?: string;
    dress_code?: string;
    rsvp_deadline?: string;
  };
  guest: {
    full_name: string;
    table_number?: string;
    guest_category?: string;
  };
  invitation?: {
    short_link?: string;
    scan_url?: string;
  };
  className?: string;
  subtitle?: string;
};

export default function InvitationCardPreview({
  theme = "modern_midnight",
  event,
  guest,
  invitation,
  className,
  subtitle = "RoyalEntry invitation",
}: InvitationCardPreviewProps) {
  const tpl = getTemplate(theme);

  return (
    <div
      className={`rounded-[32px] bg-gradient-to-br ${tpl.accent} p-[1px] shadow-2xl ${className ?? ""}`}
    >
      <div className={`rounded-[31px] ${tpl.shell} p-7`}>
        <CardHeader tpl={tpl} title={event.title} subtitle={subtitle} />
        <Divider tpl={tpl} />

        {tpl.layout === "compact" ? (
          <CompactBody
            tpl={tpl}
            event={event}
            guest={guest}
            invitation={invitation}
          />
        ) : tpl.layout === "stacked" ? (
          <StackedBody
            tpl={tpl}
            event={event}
            guest={guest}
            invitation={invitation}
          />
        ) : (
          <FullBody
            tpl={tpl}
            event={event}
            guest={guest}
            invitation={invitation}
          />
        )}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function CardHeader({
  tpl,
  title,
  subtitle,
}: {
  tpl: CardTemplate;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {tpl.monogram && (
            <span className="text-2xl leading-none opacity-80">
              {tpl.monogram}
            </span>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">
            {subtitle}
          </p>
        </div>
        <h2 className="mt-3 text-3xl font-black tracking-tight">{title}</h2>
      </div>
      {tpl.badge && (
        <Badge
          label={tpl.badge}
          className={
            tpl.light
              ? "bg-slate-100 text-slate-800 ring-1 ring-slate-200"
              : "bg-white/15 text-white ring-0"
          }
        />
      )}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider({ tpl }: { tpl: CardTemplate }) {
  const dividerMap: Record<string, string> = {
    gold: "border-gold-400/60",
    silver: "border-slate-400/60",
    floral: "border-rose-300/60",
    geometric: "border-sky-400/60",
    minimal: "border-current/20",
    double: "border-current/30",
  };
  const color = dividerMap[tpl.divider ?? "minimal"] ?? "border-current/20";

  if (tpl.divider === "double") {
    return (
      <div className="my-5 space-y-1">
        <div className={`border-t ${color}`} />
        <div className={`border-t ${color}`} />
      </div>
    );
  }

  return <div className={`my-5 border-t ${color}`} />;
}

// ── Full / Split / Ornate body ────────────────────────────────────────────────

function FullBody({
  tpl,
  event,
  guest,
  invitation,
}: {
  tpl: CardTemplate;
  event: InvitationCardPreviewProps["event"];
  guest: InvitationCardPreviewProps["guest"];
  invitation?: InvitationCardPreviewProps["invitation"];
}) {
  const isSplit = tpl.layout === "split";
  return (
    <div
      className={`grid gap-5 ${isSplit ? "md:grid-cols-[1.2fr_auto]" : "md:grid-cols-[1.4fr_auto]"}`}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] opacity-70">
            Guest
          </p>
          <p className="mt-1 text-2xl font-bold">{guest.full_name}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock
            label="Table"
            value={
              guest.table_number
                ? `Table ${guest.table_number}`
                : "To be assigned"
            }
            tpl={tpl}
          />
          <InfoBlock
            label="Category"
            value={guest.guest_category ?? "Regular"}
            tpl={tpl}
          />
          <InfoBlock
            label="Dress code"
            value={event.dress_code ?? "As communicated by host"}
            tpl={tpl}
          />
          <InfoBlock
            label="RSVP"
            value={
              event.rsvp_deadline
                ? `By ${formatDate(event.rsvp_deadline)}`
                : "Open now"
            }
            tpl={tpl}
          />
        </div>
        <div
          className={`rounded-2xl border p-4 text-sm leading-6 ${tpl.panel}`}
        >
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            When & where
          </p>
          <p className="mt-2 font-semibold">
            {event.venue_name ?? "Venue to be announced"} ·{" "}
            {formatDate(event.event_date)}
            {event.event_time ? ` · ${event.event_time}` : ""}
          </p>
          <p className="mt-1 opacity-80">
            {event.venue_address ??
              "Venue directions and final ceremony details will appear here for guests."}
          </p>
        </div>
      </div>
      <QrPanel tpl={tpl} invitation={invitation} />
    </div>
  );
}

// ── Stacked body (vertical, festive) ──────────────────────────────────────────

function StackedBody({
  tpl,
  event,
  guest,
  invitation,
}: {
  tpl: CardTemplate;
  event: InvitationCardPreviewProps["event"];
  guest: InvitationCardPreviewProps["guest"];
  invitation?: InvitationCardPreviewProps["invitation"];
}) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.28em] opacity-70">
          Guest of honour
        </p>
        <p className="mt-1 text-3xl font-black">{guest.full_name}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoBlock
          label="Table"
          value={guest.table_number ? `Table ${guest.table_number}` : "TBA"}
          tpl={tpl}
        />
        <InfoBlock
          label="Category"
          value={guest.guest_category ?? "Regular"}
          tpl={tpl}
        />
        <InfoBlock
          label="Dress code"
          value={event.dress_code ?? "As communicated"}
          tpl={tpl}
        />
      </div>
      <div
        className={`rounded-2xl border p-4 text-center text-sm leading-6 ${tpl.panel}`}
      >
        <p className="font-semibold">
          {event.venue_name ?? "Venue to be announced"} ·{" "}
          {formatDate(event.event_date)}
          {event.event_time ? ` · ${event.event_time}` : ""}
        </p>
        <p className="mt-1 opacity-80">
          {event.venue_address ?? "Details will be shared closer to the date."}
        </p>
      </div>
      <div className="flex justify-center">
        <QrPanel tpl={tpl} invitation={invitation} />
      </div>
    </div>
  );
}

// ── Compact body (pocket pass) ────────────────────────────────────────────────

function CompactBody({
  tpl,
  event,
  guest,
  invitation,
}: {
  tpl: CardTemplate;
  event: InvitationCardPreviewProps["event"];
  guest: InvitationCardPreviewProps["guest"];
  invitation?: InvitationCardPreviewProps["invitation"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Guest</p>
          <p className="mt-0.5 text-xl font-bold leading-tight">
            {guest.full_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full border px-3 py-1 font-semibold ${tpl.panel}`}
          >
            {formatDate(event.event_date)}
            {event.event_time ? ` · ${event.event_time}` : ""}
          </span>
          <span
            className={`rounded-full border px-3 py-1 font-semibold ${tpl.panel}`}
          >
            {guest.table_number ? `Table ${guest.table_number}` : "Table TBA"}
          </span>
          <span
            className={`rounded-full border px-3 py-1 font-semibold ${tpl.panel}`}
          >
            {guest.guest_category ?? "Regular"}
          </span>
        </div>
        <p className="text-xs opacity-75">
          {event.venue_name ?? "Venue TBA"} ·{" "}
          {event.dress_code ?? "Dress as communicated"}
        </p>
      </div>
      <div
        className={`flex flex-col items-center rounded-2xl border p-4 ${tpl.panel}`}
      >
        <QrCodeImage
          value={invitation?.scan_url}
          size={120}
          className="mx-auto rounded-xl bg-white p-2"
          alt="Invitation QR code"
        />
        <p className="mt-2 max-w-[140px] break-all text-center text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {invitation?.short_link ?? "Generate to preview"}
        </p>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function InfoBlock({
  label,
  value,
  tpl,
}: {
  label: string;
  value: string;
  tpl: CardTemplate;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tpl.panel}`}>
      <p className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function QrPanel({
  tpl,
  invitation,
}: {
  tpl: CardTemplate;
  invitation?: InvitationCardPreviewProps["invitation"];
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-[28px] border p-5 text-center ${tpl.panel}`}
    >
      <QrCodeImage
        value={invitation?.scan_url}
        size={168}
        className="mx-auto rounded-2xl bg-white p-3"
        alt="Invitation QR code"
      />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
        Secure access code
      </p>
      <p className="mt-2 max-w-[180px] break-all text-xs opacity-75">
        {invitation?.short_link ??
          "Generate invitations to preview a unique QR code"}
      </p>
    </div>
  );
}
