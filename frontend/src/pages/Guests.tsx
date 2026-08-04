// ==============================================================================
// FILE: src/pages/Guests.tsx
// ==============================================================================
import { useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Upload,
  Trash2,
  Pencil,
  Search,
  Phone,
  TableProperties,
  Download,
  X,
  
  AlertCircle,
  FileText,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { guestsApi } from "@/api/guests";
import type { GuestWithRsvp, CreateGuestInput } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone required"),
  email: z.string().email().optional().or(z.literal("")),
  table_number: z.string().optional(),
  guest_category: z
    .enum(["VIP", "Regular", "Staff", "Family", "Friend"])
    .optional(),
  plus_one_allowed: z.boolean().optional(),
  contact_method: z.enum(["whatsapp", "sms", "email", "telegram"]).optional(),
});

type GuestForm = z.infer<typeof schema>;

const CATEGORIES = ["VIP", "Regular", "Staff", "Family", "Friend"];
const METHODS = ["whatsapp", "sms", "email", "telegram"];

interface ImportResult {
  summary: {
    total_rows: number;
    successful: number;
    failed: number;
    skipped_duplicates: number;
  };
  errors: Array<{
    row_number: number;
    field: string | null;
    message: string;
    raw_data: string | null;
  }>;
}

export default function Guests() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestWithRsvp | null>(null);
  const [page, setPage] = useState(1);
  const [filterRsvp, setFilterRsvp] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["guests", eventId, page, filterRsvp],
    queryFn: () => guestsApi.list(eventId!, page, 20, filterRsvp),
    enabled: !!eventId,
  });

  const guests = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const pages = data?.pagination.total_pages ?? 1;

  const filtered = search
    ? guests.filter(
        (g) =>
          g.full_name.toLowerCase().includes(search.toLowerCase()) ||
          g.phone.includes(search)
      )
    : guests;

  const addMutation = useMutation({
    mutationFn: (d: CreateGuestInput) => guestsApi.add(eventId!, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      setShowAdd(false);
      toast.success("Guest added");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to add guest";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: Partial<CreateGuestInput>) =>
      guestsApi.update(eventId!, editingGuest!.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      setEditingGuest(null);
      toast.success("Guest updated");
    },
    onError: () => toast.error("Failed to update guest"),
  });

  const deleteMutation = useMutation({
    mutationFn: (guestId: string) => guestsApi.remove(eventId!, guestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      toast.success("Guest removed");
    },
    onError: () => toast.error("Failed to remove guest"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<GuestForm>({ resolver: zodResolver(schema) });

  const openEdit = (g: GuestWithRsvp) => {
    setEditingGuest(g);
    setValue("full_name", g.full_name);
    setValue("phone", g.phone);
    setValue("email", g.email ?? "");
    setValue("table_number", g.table_number ?? "");
    setValue("guest_category", g.guest_category as any);
    setValue("contact_method", g.contact_method as any);
  };

  const onSubmit = (d: GuestForm) => {
    if (editingGuest) updateMutation.mutate(d);
    else addMutation.mutate(d as CreateGuestInput);
    reset();
  };

  // ── CSV Import Handler ──────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB");
      return;
    }

    setIsUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/v1/events/${eventId}/guests/import`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Import failed");
      }

      setImportResult(result.data);
      qc.invalidateQueries({ queryKey: ["guests", eventId] });

      if (result.data.summary.successful > 0) {
        toast.success(
          `Successfully imported ${result.data.summary.successful} guests`
        );
      }

      if (result.data.summary.failed > 0) {
        toast.error(
          `${result.data.summary.failed} rows had errors. See details below.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [eventId, qc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ── Drag and Drop ───────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // ── Download Template ───────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const response = await fetch(
        `/api/v1/events/${eventId}/guests/template`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to download template");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "guest_import_template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded");
    } catch (err) {
      toast.error("Failed to download template");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterRsvp}
            onChange={(e) => {
              setFilterRsvp(e.target.checked);
              setPage(1);
            }}
            className="rounded accent-gold-500"
          />
          Show RSVP
        </label>
        <span className="text-sm text-gray-500 ml-auto">{total} guests</span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={downloadTemplate}
        >
          <Download className="w-4 h-4" /> Template
        </Button>
        
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="w-4 h-4" />
          {isUploading ? "Importing…" : "Import CSV"}
        </Button>
        
        <Button
          size="sm"
          onClick={() => {
            setShowAdd(true);
            setEditingGuest(null);
            reset();
          }}
        >
          <Plus className="w-4 h-4" /> Add Guest
        </Button>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragging
            ? "border-gold-500 bg-gold-50"
            : "border-gray-300 bg-gray-50"
        }`}
      >
        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          Drag and drop your CSV file here, or click "Import CSV" above
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Max file size: 5MB · Max 500 guests per import
        </p>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Import Results
            </h3>
            <button
              onClick={() => setImportResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">Total Rows</p>
              <p className="text-xl font-bold text-blue-900">
                {importResult.summary.total_rows}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium">Successful</p>
              <p className="text-xl font-bold text-green-900">
                {importResult.summary.successful}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium">Failed</p>
              <p className="text-xl font-bold text-red-900">
                {importResult.summary.failed}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium">
                Duplicates Skipped
              </p>
              <p className="text-xl font-bold text-amber-900">
                {importResult.summary.skipped_duplicates}
              </p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Errors ({importResult.errors.length}):
              </p>
              <div className="space-y-1">
                {importResult.errors.slice(0, 20).map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 rounded p-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium">
                        Row {err.row_number}
                        {err.field && ` (${err.field})`}:
                      </span>{" "}
                      <span className="text-red-700">{err.message}</span>
                    </div>
                  </div>
                ))}
                {importResult.errors.length > 20 && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    …and {importResult.errors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guest List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Loading guests…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No guests found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Name",
                  "Phone",
                  "Table",
                  "Category",
                  "Contact",
                  ...(filterRsvp ? ["RSVP"] : []),
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {g.full_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {g.phone}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {g.table_number ? (
                      <span className="inline-flex items-center gap-1">
                        <TableProperties className="w-3.5 h-3.5 text-gray-400" />
                        {g.table_number}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {g.guest_category ? (
                      <Badge label={g.guest_category} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">
                    {g.contact_method}
                  </td>
                  {filterRsvp && (
                    <td className="px-4 py-3">
                      {g.rsvp_response ? (
                        <Badge label={g.rsvp_response} />
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(g)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${g.full_name}?`))
                            deleteMutation.mutate(g.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Add/Edit Guest Modal */}
      <Modal
        isOpen={showAdd || !!editingGuest}
        onClose={() => {
          setShowAdd(false);
          setEditingGuest(null);
          reset();
        }}
        title={editingGuest ? "Edit Guest" : "Add Guest"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Full Name *"
                placeholder="Hassan Mohammed"
                error={errors.full_name?.message}
                {...register("full_name")}
              />
            </div>
            <Input
              label="Phone *"
              placeholder="+255700001001"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <Input
              label="Table Number"
              placeholder="5"
              {...register("table_number")}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Category
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold-400 outline-none"
                {...register("guest_category")}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Contact Via
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold-400 outline-none"
                {...register("contact_method")}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Input
                label="Email"
                type="email"
                placeholder="optional@example.com"
                {...register("email")}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="plus_one"
                className="rounded accent-gold-500"
                {...register("plus_one_allowed")}
              />
              <label htmlFor="plus_one" className="text-sm text-gray-700">
                Allow plus-one
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              className="flex-1"
              isLoading={addMutation.isPending || updateMutation.isPending}
            >
              {editingGuest ? "Save Changes" : "Add Guest"}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowAdd(false);
                setEditingGuest(null);
                reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}