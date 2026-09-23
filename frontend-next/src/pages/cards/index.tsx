"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function CardTemplatesPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: async () => (await api.get("/cards/templates")).data.data,
  });
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/files/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (response) => toast.success(`Uploaded ${response.data.data.file_name}`),
    onError: (error: any) => toast.error(error?.response?.data?.error?.message ?? "Upload failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Card Templates</h1>
          <p className="text-sm text-slate-500">Design invitation cards with QR placeholders and text fields</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-gold-300 hover:text-gold-700">
          <Palette className="h-4 w-4" /> Upload background
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            event.currentTarget.value = "";
          }} />
        </label>
      </div>

      <Card title="Available Templates">
        {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No card templates available</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template: any) => (
              <div key={template.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{template.name}</h4>
                    <p className="text-xs text-slate-500">{template.status ?? "Available"}</p>
                  </div>
                  <Badge label={template.status ?? "Published"} variant="green" />
                </div>
                <p className="mt-3 text-xs text-slate-500">{template.background_file_id ? "Custom background" : "No background uploaded"}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
