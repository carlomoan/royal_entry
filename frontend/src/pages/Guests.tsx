// ==============================================================================
// FILE: src/pages/Guests.tsx
// ==============================================================================
// Guest management — list, add single, bulk import, edit, delete

import { useState, useRef } from "react";
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

export default function Guests() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestWithRsvp | null>(null);
  const [page, setPage] = useState(1);
  const [filterRsvp, setFilterRsvp] = useState(false);

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
          g.phone.includes(search),
      )
    : guests;

  // ── Mutations ───────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (d: CreateGuestInput) => guestsApi.add(eventId!, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      setShowAdd(false);
      toast.success("Guest added");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? "Failed to add guest"),
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

  // ── Form ────────────────────────────────────────────────────────────────────

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

  // ── Bulk CSV import ─────────────────────────────────────────────────────────

  const fileRef = useRef<HTMLInputElement>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    const guests: CreateGuestInput[] = lines
      .map((line) => {
        const [full_name, phone, email, table_number, guest_category] = line
          .split(",")
          .map((s) => s.trim());
        return {
          full_name,
          phone,
          email: email || undefined,
          table_number: table_number || undefined,
          guest_category: (guest_category || "Regular") as any,
        };
      })
      .filter((g) => g.full_name && g.phone);

    if (!guests.length) {
      toast.error("No valid guests found in CSV");
      return;
    }

    try {
      const result = await guestsApi.bulkAdd(eventId!, guests);
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      toast.success(`${result.length} guests imported`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Import failed");
    }
    e.target.value = "";
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none"
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
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleBulkUpload}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-4 h-4" /> Import CSV
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

      {/* CSV format hint */}
      <p className="text-xs text-gray-400">
        CSV format:{" "}
        <code className="bg-gray-100 px-1 rounded">
          full_name, phone, email, table_number, category
        </code>
      </p>

      {/* Table */}
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
                      {(g as any).rsvp_response ? (
                        <Badge label={(g as any).rsvp_response} />
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

      {/* Add / Edit Modal */}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                                 focus:ring-2 focus:ring-gold-400 outline-none"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                                 focus:ring-2 focus:ring-gold-400 outline-none"
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
