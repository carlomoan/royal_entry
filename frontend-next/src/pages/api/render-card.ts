// ============================================================================
// GET /api/render-card?eventId=&guestId=&invitationId=&format=png|jpeg|pdf
//
// Server-side render of a guest's card using the SAME RoyalCardTheme renderer
// as the studio and guest page — so exports are pixel-identical to previews.
//
//   PNG/JPEG → one image with all pages side-by-side (print-shop sheet)
//   PDF      → one page per theme page, exact card dimensions
//
// Requires: npm i puppeteer qrcode
// ============================================================================
import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeTheme, RoyalCardTheme } from "@/types/royal-card";
import { buildCardData } from "@/lib/cardData";
// RoyalCardPage is imported dynamically so server-side react-dom render
// never pulls browser-only dependencies into edge bundles.
import React from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_INTERNAL_URL ?? "";

async function backendGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Backend ${path} → ${res.status}`);
  return res.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { eventId, guestId, invitationId, format = "png" } = req.query as Record<string, string>;
  if (!eventId || !guestId || !invitationId) {
    return res.status(400).json({ error: "eventId, guestId and invitationId are required" });
  }

  let browser;
  try {
    // ------------------------------------------------ fetch real data
    const [eventRes, guestRes] = await Promise.all([
      backendGet(`/events/${eventId}`),
      backendGet(`/events/${eventId}/guests/${guestId}`),
    ]);
    const event = eventRes.data ?? eventRes;
    const guest = guestRes.data ?? guestRes;

    if (!event?.card_template_id) {
      return res.status(409).json({ error: "Event has no card_template_id assigned" });
    }
    const templateRes = await backendGet(`/cards/templates/${event.card_template_id}`);
    const template = templateRes.data ?? templateRes;
    const theme: RoyalCardTheme = normalizeTheme({ ...(template.theme_config ?? {}), name: template.name });

    const invitationsRes = await backendGet(`/events/${eventId}/invitations`);
    const invitation = (invitationsRes.data ?? []).find((i: any) => i.id === invitationId);

    const data = buildCardData(event, guest, invitation, invitation?.scan_url ?? invitation?.scan_payload);

    // ------------------------------------------------ render HTML (pages side by side)
    const { RoyalCardPage } = await import("@/components/cards/RoyalCard");
    const W = theme.size.width, H = theme.size.height;
    const pagesHtml = theme.pages
      .map((p) => renderToStaticMarkup(React.createElement(RoyalCardPage as any, { page: p, data, width: W, height: H })))
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Great+Vibes&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; }
  body { background: #fff; }
  #sheet { display: flex; gap: 32px; padding: 32px; width: max-content; }
  .royal-card { box-shadow: 0 0 0 1px rgba(0,0,0,0.05); }
  @page { size: ${W}px ${H}px; margin: 0; }
  .page-break { page-break-after: always; }
</style></head>
<body><div id="sheet">${pagesHtml}</div></body></html>`;

    // ------------------------------------------------ screenshot
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--force-color-profile=srgb"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: (W + 32) * theme.pages.length + 32, height: H + 64, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => (document as any).fonts.ready);

    const stamp = `${(guest.full_name ?? "guest").replace(/\s+/g, "_")}`;

    if (format === "pdf") {
      // Re-layout: stack pages vertically with page-breaks for exact-size PDF pages
      await page.evaluate(() => {
        const sheet = document.getElementById("sheet")!;
        sheet.style.flexDirection = "column";
        sheet.style.gap = "0px";
        sheet.style.padding = "0px";
        sheet.querySelectorAll(".royal-card").forEach((el) => ((el as HTMLElement).style.boxShadow = "none"));
      });
      const pdf = await page.pdf({
        width: `${W}px`,
        height: `${H}px`,
        printBackground: true,
        pageRanges: `1-${theme.pages.length}`,
      });
      await browser.close();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invitation_${stamp}.pdf"`);
      return res.send(Buffer.from(pdf));
    }

    const image = await page.screenshot({
      type: format === "jpeg" ? "jpeg" : "png",
      quality: format === "jpeg" ? 95 : undefined,
      omitBackground: false,
    });
    await browser.close();
    res.setHeader("Content-Type", `image/${format === "jpeg" ? "jpeg" : "png"}`);
    res.setHeader("Content-Disposition", `attachment; filename="invitation_${stamp}.${format}"`);
    return res.send(image);
  } catch (e: any) {
    if (browser) await browser.close().catch(() => {});
    console.error("render-card error:", e);
    return res.status(500).json({ error: e?.message ?? "Render failed" });
  }
}

// Raise body limit not needed (GET), but keep Next from buffering the page html
export const config = { api: { responseLimit: false } };
