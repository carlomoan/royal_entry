"use client";
// Venue QR page (/w/<event>) — asks for the guest's check-in code or phone and
// only reveals the arrival message if that guest has actually been checked in.
import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2, AlertCircle, Heart, Play, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import { Button, Card, Badge } from "@/components/ui";
import BrandLogo from "@/components/brand/BrandLogo";

export default function VenueMessagePage() {
  const router = useRouter();
  const eventId = router.query.event as string | undefined;
  const [code, setCode] = useState("");

  const { data: info } = useQuery({
    queryKey: ["venue-info", eventId],
    queryFn: async () => (await api.get(`/public/w/${eventId}`)).data.data,
    enabled: !!eventId,
  });

  const messageQuery = useMutation({
    mutationFn: (value: string) =>
      api.post(`/public/w/${eventId}/view`, { code: value }).then((r) => r.data.data),
  });

  const data = messageQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <BrandLogo
              showName
              className="h-10 w-10"
              nameClassName="text-sm font-bold uppercase tracking-[0.3em] text-white"
            />
          </div>
          <h1 className="mt-3 text-3xl font-black">{info?.title ?? "Welcome"}</h1>
          {info?.venue && <p className="mt-1 text-sm text-slate-400">{info.venue}</p>}
        </div>

        {!data ? (
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gold-500" />
              <h2 className="text-lg font-bold text-slate-900">Your arrival message</h2>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Enter the check-in code from your invitation card (or the phone number you registered) to view your welcome message.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) messageQuery.mutate(code.trim());
              }}
              className="space-y-4"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. ROYAL-1234 or +255712345678"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
              />
              {messageQuery.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>We couldn&apos;t confirm your arrival yet. Check your code, or see the gate team if you have just arrived.</span>
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" isLoading={messageQuery.isPending}>
                {messageQuery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                View my message
              </Button>
            </form>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <Badge label={`Welcome, ${data.guest_name}`} variant="gold" />
            </div>
            {data.messages.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-600">
                Your welcome message will appear here once the organizer releases it.
              </Card>
            ) : (
              data.messages.map((m: any) => (
                <Card key={m.id} className="overflow-hidden p-0">
                  <div className="bg-navy-950 px-6 py-5">
                    <h2 className="text-xl font-black text-gold-400">{m.title}</h2>
                  </div>
                  <div className="space-y-4 p-6 text-slate-800">
                    <p className="whitespace-pre-wrap text-base leading-relaxed">{m.body}</p>
                    {m.media_url && (
                      <a href={m.media_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gold-300 px-4 py-2 text-sm font-semibold text-gold-700 hover:bg-gold-50">
                        {m.media_type === "image" ? <ImageIcon className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        Open {m.media_type ?? "media"}
                      </a>
                    )}
                    {m.contribution_block && (
                      <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
                        <div className="mb-1 flex items-center gap-2 font-bold text-slate-900">
                          <Heart className="h-4 w-4 text-gold-700" /> How to contribute
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{m.contribution_block}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}