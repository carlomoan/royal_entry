// ==============================================================================
// FILE: src/pages/platform/PlatformSettings.tsx
// ==============================================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { settingsApi } from "@/api/settings";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export default function PlatformSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => settingsApi.getSystem(),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.updateSystemSettings(draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings saved");
      setDraft({});
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    },
  });

  const settings = (data as Record<string, unknown>) ?? {};
  const merged = { ...settings, ...draft };

  const handleChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    const trimmedKey = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    setDraft((prev) => ({ ...prev, [trimmedKey]: newValue }));
    setNewKey("");
    setNewValue("");
    setAddKeyOpen(false);
    toast.success(`Added "${trimmedKey}" — save to persist`);
  };

  const handleRemoveKey = (key: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // If the key exists in the original settings, we need to null it out on save
    if (key in settings) {
      setDraft((prev) => ({ ...prev, [key]: "__DELETE__" }));
    }
  };

  const hasChanges = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Global configuration variables for the RoyalEntry platform.
        </p>
      </div>

      <Card
        title="Configuration variables"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddKeyOpen(true)}>
              <Plus className="h-4 w-4" /> Add variable
            </Button>
            {hasChanges && (
              <Button size="sm" onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
                <Save className="h-4 w-4" /> Save changes
              </Button>
            )}
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : Object.keys(merged).length === 0 ? (
          <div className="p-12 text-center">
            <Settings2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No settings configured</p>
            <p className="text-xs text-slate-500 mt-1">
              Add your first variable using the button above
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">

            {Object.entries(merged).map(([key, value]) => {
              const isDeleted = value === "__DELETE__";
              if (isDeleted) return null;
              const isDraft = key in draft && draft[key] !== undefined && draft[key] !== (settings as any)[key]?.toString();
              return (
                <div key={key} className={`flex items-start gap-4 py-3 ${isDraft ? "bg-amber-50 -mx-6 px-6 rounded-lg" : ""}`}>
                  <div className="flex-1 space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {key.replace(/_/g, " ")}
                      {isDraft && <span className="ml-2 text-xs font-normal text-amber-600 normal-case">(unsaved)</span>}
                    </label>
                    <Input
                      value={value?.toString() ?? ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder="Enter value…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveKey(key)}
                    className="mt-6 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {hasChanges && (
              <div className="pt-4 flex justify-end">
                <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save all changes
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add variable modal */}
      <Modal isOpen={addKeyOpen} onClose={() => setAddKeyOpen(false)} title="Add variable" size="sm">
        <div className="space-y-4">
          <Input
            label="Variable key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g. max_upload_size_mb"
          />
          <Input
            label="Initial value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g. 50"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setAddKeyOpen(false)}>Cancel</Button>
            <Button onClick={handleAddKey}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}