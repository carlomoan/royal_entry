// frontend/src/lib/cardData.ts

/**
 * Maps raw database event, guest, and invitation records 
 * into the standardized {{TOKEN}} format used by RoyalCardPage.
 */
export function buildCardData(
    event: any,
    guest: any,
    invitation: any,
    qrPayload?: string
): Record<string, string> {
    return {
        GUEST_NAME: guest?.full_name ?? "Mgeni",
        GUEST_SEATNO: guest?.table_number ?? "—",
        GUEST_TABLE: guest?.table_number ? `Meza ${guest.table_number}` : "—",
        GUEST_CATEGORY: guest?.guest_category ?? "Regular",

        EVENT_TITLE: event?.title ?? "",
        EVENT_TYPE: event?.event_type ?? "Harusi",

        // Swahili date formatting matching your reference design
        EVENT_DATE: event?.event_date
            ? new Intl.DateTimeFormat("sw-TZ", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(new Date(event.event_date)).toUpperCase()
            : "",

        // Merge character names for couple events
        EVENT_CHARACTERS: event?.character_name_1 && event?.character_name_2
            ? `${event.character_name_1} & ${event.character_name_2}`
            : event?.character_name_1 ?? "",

        EVENT_VENUE: event?.venue_name ?? "",
        EVENT_ADDRESS: event?.venue_address ?? "",
        EVENT_START_TIME: event?.event_time ?? "",

        // QR payload priority chain
        QR_CODE: qrPayload ?? invitation?.scan_payload ?? invitation?.short_link ?? "",
    };
}