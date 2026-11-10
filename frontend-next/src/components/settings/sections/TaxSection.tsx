"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

export default function TaxSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });

  const [enabled, setEnabled] = useState(false);
  const [inclusive, setInclusive] = useState(true);
  const [vatRate, setVatRate] = useState("18");
  const [traApiUrl, setTraApiUrl] = useState("");
  const [traApiKey, setTraApiKey] = useState("");
  const [traSecretKey, setTraSecretKey] = useState("");

  useEffect(() => {
    if (settings) {
      setEnabled(!!settings.tax_enabled);
      setInclusive(settings.tax_inclusive !== false);
      setVatRate(String(settings.tax_vat_rate_percent ?? 18));
      setTraApiUrl(settings.tax_tra_api_url ?? "");
      // Secrets come back masked — treat as write-only (blank keeps the saved key).
      setTraApiKey(settings.tax_tra_api_key === "********" ? "" : (settings.tax_tra_api_key ?? ""));
      setTraSecretKey(settings.tax_tra_secret_key === "********" ? "" : (settings.tax_tra_secret_key ?? ""));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("Tax settings saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleSave = () => {
    const rate = parseFloat(vatRate);
    const payload: Record<string, unknown> = {
      tax_enabled: enabled,
      tax_inclusive: inclusive,
      tax_vat_rate_percent: isNaN(rate) ? 18 : rate,
      tax_tra_api_url: traApiUrl,
    };
    // Only send secrets when a new value was typed (write-only).
    if (traApiKey.trim()) payload.tax_tra_api_key = traApiKey;
    if (traSecretKey.trim()) payload.tax_tra_secret_key = traSecretKey;
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tax & TRA</h1>
        <p className="text-sm text-slate-500">
          Tanzania Revenue Authority (TRA) configuration and VAT applied to account invoice generation
        </p>
      </div>

      <Card title="Tax on invoices">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
              Apply tax (VAT) to generated invoices
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">VAT rate (%)</label>
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
                  Tax-inclusive pricing
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {inclusive
                ? "Plan prices already include VAT — the tax portion is shown separately on each invoice (net + VAT = total)."
                : "VAT is added on top of plan prices — each invoice shows the net amount plus VAT."}
            </p>
          </div>
        )}
      </Card>

      <Card title="TRA API">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-4">
            <Input label="API URL" value={traApiUrl} onChange={(e) => setTraApiUrl(e.target.value)} placeholder="https://api.tra.go.tz/..." />
            <Input label="API Key" value={traApiKey} onChange={(e) => setTraApiKey(e.target.value)} placeholder={traApiKey ? "TRA API key" : "Saved — leave blank to keep"} />
            <Input label="Secret Key" type="password" value={traSecretKey} onChange={(e) => setTraSecretKey(e.target.value)} placeholder={traSecretKey ? "TRA secret key" : "Saved — leave blank to keep"} />
            <p className="text-xs text-slate-500">
              These credentials are stored server-side only (never exposed to the browser bundle). Used for e-invoice submission to TRA.
            </p>
            <div className="flex justify-end">
              <Button onClick={handleSave} isLoading={saveMutation.isPending}>
                <Save className="h-4 w-4" /> Save tax settings
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}