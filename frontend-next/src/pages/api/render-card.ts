import type { NextApiRequest, NextApiResponse } from "next";

function cardRenderUrl(): string {
  const configured = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3000";
  const base = configured.replace(/\/$/, "");
  return base.endsWith("/api/v1") ? `${base}/cards/render` : `${base}/api/v1/cards/render`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { eventId, guestId, templateId } = req.query;
  if (typeof eventId !== "string" || typeof guestId !== "string") {
    return res.status(400).json({ error: "eventId and guestId are required" });
  }

  try {
    const response = await fetch(cardRenderUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(typeof req.headers.authorization === "string" ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({
        event_id: eventId,
        guest_id: guestId,
        ...(typeof templateId === "string" ? { template_id: templateId } : {}),
      }),
    });

    const body = Buffer.from(await response.arrayBuffer());
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") ?? "application/octet-stream");
    const disposition = response.headers.get("content-disposition");
    if (disposition) res.setHeader("Content-Disposition", disposition);
    return res.send(body);
  } catch (error) {
    console.error("Card render proxy failed", error);
    return res.status(502).json({ error: "Card rendering service is unavailable" });
  }
}

export const config = { api: { responseLimit: false } };
