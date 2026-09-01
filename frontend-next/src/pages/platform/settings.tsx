"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

export default function PlatformSettingsPage() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("Settings saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const merged = { ...settings, ...draft };

  const handleChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    Object.entries(merged).forEach(([k, v]) => {
      const num = Number(v);
      payload[k] = v === "" || isNaN(num) ? v : num;
    });
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
          <p className="text-sm text-slate-500">Global configuration</p>
        </div>
        <Button onClick={handleSave} isLoading={saveMutation.isPending}><Save className="h-4 w-4" /> Save</Button>
      </div>

      <Card title="Configuration">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : Object.keys(merged).length === 0 ? (
          <div className="py-12 text-center"><Settings className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No settings configured</p></div>
        ) : (
          <div className="grid max-w-lg gap-4">
            {Object.entries(merged).map(([key, value]) => (
              <Input
                key={key}
                label={key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                value={value?.toString() ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            ))}
            <div className="pt-2">
              <Button onClick={handleSave} isLoading={saveMutation.isPending}><Save className="h-4 w-4" /> Save settings</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}