"use client";
// Corporate event packages, bookings, tables and seating suggestions.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, CheckCircle2, Armchair, Lightbulb, X, Building2, Ticket,
  RefreshCw, FileText, Wallet, Users, Printer, MailCheck, Link2, Send, Ban, Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type Package = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_tsh: number;
  seats_per_table: number;
  card_template_id: string | null;
  is_active: boolean;
  created_at: string;
};

type BookingPackage = {
  package_id: string;
  name: string;
  quantity: number;
  price_tsh: number;
  seats_per_table: number;
};

type BookingTable = {
  id: string;
  table_number: string;
  package_id: string | null;
};

type Booking = {
  id: string;
  event_id: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string | null;
  payment_reference: string | null;
  amount_paid: number;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  total_amount: number;
  balance: number;
  passes_created: number;
  packages: BookingPackage[];
  tables: BookingTable[];
  workflow_status: string;
  registration_token: string | null;
  contact_email_verified_at: string | null;
  contact_email_is_free: boolean;
};

type BookingPass = {
  guest_id: string;
  full_name: string;
  pass_state: string;
  table_number: string | null;
  package_name: string | null;
};

type BookingPassInfo = { passes: BookingPass[] };

type SeatingSuggestion = {
  table_number: string;
  reason: string;
  seated: number;
  capacity: number;
};

type CardTemplate = { id: string; name: string; is_active?: boolean };

type CorporateReport = {
  total_bookings: number;
  confirmed_bookings: number;
  total_revenue: number;
  total_paid: number;
  total_balance: number;
  total_passes: number;
  passes_arrived: number;
  by_package: {
    package_id: string; name: string; bookings: number; seats: number; passes: number;
    arrived: number; revenue: number; paid: number; balance: number;
  }[];
  by_company: {
    booking_id: string; company_name: string; contact_person: string; confirmed: boolean;
    total: number; paid: number; balance: number; passes: number; arrived: number;
  }[];
  by_table: {
    table_number: string; company_name: string | null; capacity: number; passes: number; seated: number;
  }[];
};

type BookingInvoice = {
  id: string;
  organization_id: string;
  event_id: string;
  booking_id: string;
  invoice_number: string;
  amount_tsh: number;
  tax_rate_percent: number;
  tax_amount_tsh: number;
  tax_inclusive: boolean;
  tin: string | null;
  status: string;
  issued_at: string;
  due_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PackagePayload = {
  name: string;
  description?: string;
  price_tsh: number;
  seats_per_table: number;
  card_template_id?: string;
  is_active: boolean;
};

type PackageForm = {
  name: string;
  description: string;
  price_tsh: string;
  seats_per_table: string;
  card_template_id: string;
  is_active: boolean;
};

type BookingForm = {
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  notes: string;
};

type BookingPackageRow = { package_id: string; quantity: string };

type ImportError = { row: number | string; message: string };
type ImportResult = {
  total_rows: number;
  created: number;
  updated?: number;
  errors: ImportError[];
};

const formatTsh = (amount: number) => `TZS ${Number(amount || 0).toLocaleString("en-TZ")}`;
const errorMessage = (e: any) =>
  e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? "Something went wrong";

const thClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const tdClass = "px-3 py-2 text-sm text-slate-700";

const emptyPackageForm: PackageForm = {
  name: "", description: "", price_tsh: "", seats_per_table: "10", card_template_id: "", is_active: true,
};
const emptyBookingForm: BookingForm = {
  company_name: "", contact_person: "", contact_phone: "", contact_email: "", notes: "",
};

const WORKFLOW_STEPS = [
  { key: "requested", label: "Requested", badgeClass: "bg-slate-100 text-slate-700" },
  { key: "invoiced", label: "Invoiced", badgeClass: "bg-gold-100 text-gold-800" },
  { key: "paid", label: "Paid", badgeClass: "bg-emerald-100 text-emerald-700" },
  { key: "passes_issued", label: "Passes issued", badgeClass: "bg-navy-100 text-navy-900" },
  { key: "names_registered", label: "Names registered", badgeClass: "bg-navy-100 text-navy-900" },
  { key: "checked_in", label: "Checked in", badgeClass: "bg-emerald-100 text-emerald-700" },
] as const;

const workflowIndex = (status?: string | null) => {
  const index = WORKFLOW_STEPS.findIndex((step) => step.key === status);
  return index < 0 ? 0 : index;
};

const passStateStyle = (state: string) => {
  switch (state) {
    case "revoked": return "bg-rose-100 text-rose-700";
    case "checked_in": return "bg-emerald-100 text-emerald-700";
    case "issued": return "bg-emerald-100 text-emerald-700";
    case "named": return "bg-navy-100 text-navy-900";
    default: return "bg-gold-100 text-gold-800";
  }
};

const normalizeImportResult = (data: any): ImportResult => ({
  total_rows: Number(data?.total_rows ?? 0),
  created: Number(data?.created ?? 0),
  updated: data?.updated === undefined ? undefined : Number(data.updated),
  errors: Array.isArray(data?.errors) ? data.errors : [],
});

function ImportResultPanel({ result }: { result: ImportResult }) {
  const errors = result.errors ?? [];
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p><span className="text-slate-500">Rows read:</span> <span className="font-semibold text-slate-900">{result.total_rows}</span></p>
        <p><span className="text-slate-500">Created:</span> <span className="font-semibold text-emerald-700">{result.created}</span></p>
        {result.updated !== undefined && (
          <p><span className="text-slate-500">Updated:</span> <span className="font-semibold text-navy-900">{result.updated}</span></p>
        )}
        <p><span className="text-slate-500">Failed:</span> <span className="font-semibold text-rose-700">{errors.length}</span></p>
      </div>
      {errors.length > 0 ? (
        <div>
          <p className="mb-2 font-semibold text-rose-700">Errors</p>
          <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-rose-50">
                <tr>
                  <th className={thClass}>Row</th>
                  <th className={thClass}>Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`}>
                    <td className={`${tdClass} whitespace-nowrap font-semibold`}>{error.row}</td>
                    <td className={`${tdClass} break-words`}>{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-emerald-700">No errors.</p>
      )}
    </div>
  );
}

export default function CorporateTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["corporate-packages", eventId] });
    qc.invalidateQueries({ queryKey: ["corporate-bookings", eventId] });
    qc.invalidateQueries({ queryKey: ["corporate-report", eventId] });
  };

  const { data: packages = [], isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ["corporate-packages", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/packages`)).data.data ?? [],
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["corporate-bookings", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/bookings`)).data.data ?? [],
  });

  const { data: cardTemplates = [] } = useQuery<CardTemplate[]>({
    queryKey: ["card-templates"],
    queryFn: async () => (await api.get("/cards/templates")).data.data ?? [],
  });

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<CorporateReport>({
    queryKey: ["corporate-report", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/corporate-report`)).data.data,
    enabled: !!eventId && eventId !== "undefined",
  });

  /* ── Package form state ─────────────────────────────────────────────── */
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackageForm);

  const openPackageModal = (pkg?: Package) => {
    setEditingPackageId(pkg?.id ?? null);
    setPackageForm(pkg ? {
      name: pkg.name,
      description: pkg.description ?? "",
      price_tsh: String(pkg.price_tsh),
      seats_per_table: String(pkg.seats_per_table),
      card_template_id: pkg.card_template_id ?? "",
      is_active: pkg.is_active,
    } : emptyPackageForm);
    setPackageModalOpen(true);
  };

  const savePackageMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: PackagePayload }) =>
      id
        ? api.put(`/events/${eventId}/packages/${id}`, payload)
        : api.post(`/events/${eventId}/packages`, payload),
    onSuccess: (_r, vars) => {
      invalidate();
      setPackageModalOpen(false);
      toast.success(vars.id ? "Package updated" : "Package added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deletePackageMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${eventId}/packages/${id}`),
    onSuccess: () => { invalidate(); toast.success("Package deleted"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submitPackage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const price = Number(packageForm.price_tsh);
    const seats = Number(packageForm.seats_per_table);
    if (!packageForm.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(seats) || seats < 1) {
      toast.error("Provide a name, a valid price and at least one seat per table");
      return;
    }
    savePackageMutation.mutate({
      id: editingPackageId ?? undefined,
      payload: {
        name: packageForm.name.trim(),
        description: packageForm.description.trim() || undefined,
        price_tsh: price,
        seats_per_table: seats,
        card_template_id: packageForm.card_template_id || undefined,
        is_active: packageForm.is_active,
      },
    });
  };

  /* ── Booking form state ────────────────────────────────────────────── */
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [bookingRows, setBookingRows] = useState<BookingPackageRow[]>([{ package_id: "", quantity: "1" }]);

  const [editBookingTarget, setEditBookingTarget] = useState<Booking | null>(null);
  const [editBookingForm, setEditBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [regeneratedLink, setRegeneratedLink] = useState<{ company: string; token: string; url: string } | null>(null);
  const [bookingImportOpen, setBookingImportOpen] = useState(false);
  const [bookingImportFile, setBookingImportFile] = useState<File | null>(null);
  const [bookingImportResult, setBookingImportResult] = useState<ImportResult | null>(null);
  const [passImportTarget, setPassImportTarget] = useState<Booking | null>(null);
  const [passImportFile, setPassImportFile] = useState<File | null>(null);
  const [passImportResult, setPassImportResult] = useState<ImportResult | null>(null);

  const openBookingModal = () => {
    setBookingForm(emptyBookingForm);
    setBookingRows([{ package_id: "", quantity: "1" }]);
    setBookingModalOpen(true);
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditBookingTarget(booking);
    setEditBookingForm({
      company_name: booking.company_name,
      contact_person: booking.contact_person,
      contact_phone: booking.contact_phone,
      contact_email: booking.contact_email ?? "",
      notes: booking.notes ?? "",
    });
  };

  const openBookingImportModal = () => {
    setBookingImportFile(null);
    setBookingImportResult(null);
    setBookingImportOpen(true);
  };

  const openPassImportModal = (booking: Booking) => {
    setPassImportFile(null);
    setPassImportResult(null);
    setPassImportTarget(booking);
  };

  const createBookingMutation = useMutation({
    mutationFn: (payload: {
      company_name: string;
      contact_person: string;
      contact_phone: string;
      contact_email?: string;
      notes?: string;
      packages: { package_id: string; quantity: number }[];
    }) => api.post(`/events/${eventId}/bookings`, payload),
    onSuccess: () => {
      invalidate();
      setBookingModalOpen(false);
      toast.success("Booking created");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submitBooking = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const selected = bookingRows
      .filter((row) => row.package_id && Number(row.quantity) > 0)
      .map((row) => ({ package_id: row.package_id, quantity: Number(row.quantity) }));
    if (!bookingForm.company_name.trim() || !bookingForm.contact_person.trim() || !bookingForm.contact_phone.trim()) {
      toast.error("Company, contact person and phone are required");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one package with a quantity");
      return;
    }
    createBookingMutation.mutate({
      company_name: bookingForm.company_name.trim(),
      contact_person: bookingForm.contact_person.trim(),
      contact_phone: bookingForm.contact_phone.trim(),
      contact_email: bookingForm.contact_email.trim() || undefined,
      notes: bookingForm.notes.trim() || undefined,
      packages: selected,
    });
  };

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BookingForm> }) =>
      api.put(`/events/${eventId}/bookings/${id}`, payload),
    onSuccess: () => {
      invalidate();
      setEditBookingTarget(null);
      toast.success("Booking updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${eventId}/bookings/${id}`),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.data.message ?? "Booking deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const importBookingsMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(`/events/${eventId}/bookings/import`, form);
      return normalizeImportResult(res.data.data);
    },
    onSuccess: (result) => {
      invalidate();
      setBookingImportResult(result);
      toast.success(`Imported ${result.created} of ${result.total_rows} booking rows`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const importPassesMutation = useMutation({
    mutationFn: async ({ bookingId, file }: { bookingId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(`/events/${eventId}/bookings/${bookingId}/passes/import`, form);
      return normalizeImportResult(res.data.data);
    },
    onSuccess: (result) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["booking-passes", eventId, passImportTarget?.id] });
      setPassImportResult(result);
      toast.success(`Imported ${result.created} new and ${result.updated ?? 0} updated pass rows`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submitEditBooking = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBookingTarget) return;
    if (!editBookingForm.company_name.trim() || !editBookingForm.contact_person.trim() || !editBookingForm.contact_phone.trim()) {
      toast.error("Company, contact person and phone are required");
      return;
    }
    updateBookingMutation.mutate({
      id: editBookingTarget.id,
      payload: {
        company_name: editBookingForm.company_name.trim(),
        contact_person: editBookingForm.contact_person.trim(),
        contact_phone: editBookingForm.contact_phone.trim(),
        contact_email: editBookingForm.contact_email.trim() || undefined,
        notes: editBookingForm.notes.trim() || undefined,
      },
    });
  };

  /* ── Confirm payment ───────────────────────────────────────────────── */
  const [confirmTarget, setConfirmTarget] = useState<Booking | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    payment_reference: "", amount_paid: "", proof_file_id: "", notes: "",
  });

  const openConfirmModal = (booking: Booking) => {
    setConfirmTarget(booking);
    setConfirmForm({
      payment_reference: booking.payment_reference ?? "",
      amount_paid: String(booking.amount_paid || ""),
      proof_file_id: "",
      notes: booking.notes ?? "",
    });
  };

  const confirmMutation = useMutation({
    mutationFn: ({ id, payload }: {
      id: string;
      payload: { payment_reference?: string; amount_paid?: number; proof_file_id?: string; notes?: string };
    }) => api.post(`/events/${eventId}/bookings/${id}/confirm`, payload),
    onSuccess: (r, vars) => {
      invalidate();
      setConfirmTarget(null);
      const result = r.data.data ?? {};
      toast.success(`Payment confirmed — ${result.passes_created ?? 0} passes created`);
      if (vars.payload.amount_paid !== undefined) toast(`Recorded payment ${formatTsh(vars.payload.amount_paid)}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submitConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirmTarget) return;
    const amount = confirmForm.amount_paid === "" ? undefined : Number(confirmForm.amount_paid);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      toast.error("Enter a valid amount paid");
      return;
    }
    confirmMutation.mutate({
      id: confirmTarget.id,
      payload: {
        payment_reference: confirmForm.payment_reference.trim() || undefined,
        amount_paid: amount,
        proof_file_id: confirmForm.proof_file_id.trim() || undefined,
        notes: confirmForm.notes.trim() || undefined,
      },
    });
  };

  /* ── Pass lifecycle ────────────────────────────────────────────────── */
  const [passesTarget, setPassesTarget] = useState<Booking | null>(null);
  const [reassignTarget, setReassignTarget] = useState<{ bookingId: string; pass: BookingPass } | null>(null);
  const [reassignForm, setReassignForm] = useState({ full_name: "", phone: "", email: "" });

  const { data: passInfo, isLoading: passesLoading } = useQuery<BookingPassInfo>({
    queryKey: ["booking-passes", eventId, passesTarget?.id],
    queryFn: async () =>
      (await api.get(`/public/bookings/${passesTarget?.registration_token}`)).data.data ?? { passes: [] },
    enabled: !!passesTarget?.registration_token,
  });

  const verifyMutation = useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/events/${eventId}/bookings/${bookingId}/send-verification`),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.data.message ?? "Verification email sent");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const issuePassesMutation = useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/events/${eventId}/bookings/${bookingId}/issue-passes`),
    onSuccess: (r) => {
      invalidate();
      const created = r.data.data?.passes_created ?? 0;
      toast.success(`${created} pass${created === 1 ? "" : "es"} created`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const copyRegistrationLink = async (token: string) => {
    const url = `${window.location.origin}/b/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error(`Could not copy link — copy it manually: ${url}`);
    }
  };

  const regenerateTokenMutation = useMutation({
    mutationFn: async (booking: Booking) =>
      (await api.post(`/events/${eventId}/bookings/${booking.id}/registration-token`)).data.data as { registration_token: string },
    onSuccess: (data, booking) => {
      invalidate();
      const token = data?.registration_token;
      if (!token) {
        toast.error("No registration token was returned");
        return;
      }
      setRegeneratedLink({
        company: booking.company_name,
        token,
        url: `${window.location.origin}/b/${token}`,
      });
      void copyRegistrationLink(token);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const resendMutation = useMutation({
    mutationFn: async (booking: Booking) => {
      const token = booking.registration_token;
      if (!token) throw new Error("Registration link is not available for this booking");
      const info = (await api.get(`/public/bookings/${token}`)).data.data as BookingPassInfo;
      const guestIds = (info?.passes ?? []).map((pass) => pass.guest_id);
      if (guestIds.length === 0) throw new Error("No passes to resend yet");
      return api.post(`/events/${eventId}/invitations/send`, { guest_ids: guestIds });
    },
    onSuccess: () => toast.success("Check-in credentials resent to the contact"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ bookingId, guestId }: { bookingId: string; guestId: string }) =>
      api.post(`/events/${eventId}/bookings/${bookingId}/passes/${guestId}/revoke`),
    onSuccess: (r, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["booking-passes", eventId, vars.bookingId] });
      toast.success(r.data.message ?? "Pass revoked");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ bookingId, guestId, payload }: {
      bookingId: string;
      guestId: string;
      payload: { full_name: string; phone: string; email?: string };
    }) => api.post(`/events/${eventId}/bookings/${bookingId}/passes/${guestId}/reassign`, payload),
    onSuccess: (r, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["booking-passes", eventId, vars.bookingId] });
      setReassignTarget(null);
      toast.success(r.data.message ?? "Pass reassigned");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openReassignModal = (bookingId: string, pass: BookingPass) => {
    setReassignForm({ full_name: pass.full_name, phone: "", email: "" });
    setReassignTarget({ bookingId, pass });
  };

  const submitReassign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reassignTarget) return;
    if (!reassignForm.full_name.trim() || !reassignForm.phone.trim()) {
      toast.error("Full name and phone are required");
      return;
    }
    reassignMutation.mutate({
      bookingId: reassignTarget.bookingId,
      guestId: reassignTarget.pass.guest_id,
      payload: {
        full_name: reassignForm.full_name.trim(),
        phone: reassignForm.phone.trim(),
        email: reassignForm.email.trim() || undefined,
      },
    });
  };

  /* ── Tables ────────────────────────────────────────────────────────── */
  const [tableTarget, setTableTarget] = useState<Booking | null>(null);
  const [tableForm, setTableForm] = useState({ table_number: "", package_id: "" });

  const openTableModal = (booking: Booking) => {
    setTableTarget(booking);
    setTableForm({ table_number: "", package_id: "" });
  };

  const addTableMutation = useMutation({
    mutationFn: ({ bookingId, payload }: {
      bookingId: string;
      payload: { table_number: string; package_id?: string };
    }) => api.post(`/events/${eventId}/bookings/${bookingId}/tables`, payload),
    onSuccess: () => { invalidate(); setTableTarget(null); toast.success("Table assigned"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const removeTableMutation = useMutation({
    mutationFn: ({ bookingId, tableId }: { bookingId: string; tableId: string }) =>
      api.delete(`/events/${eventId}/bookings/${bookingId}/tables/${tableId}`),
    onSuccess: () => { invalidate(); toast.success("Table removed"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submitTable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tableTarget || !tableForm.table_number.trim()) {
      toast.error("Enter a table number");
      return;
    }
    addTableMutation.mutate({
      bookingId: tableTarget.id,
      payload: {
        table_number: tableForm.table_number.trim(),
        package_id: tableForm.package_id || undefined,
      },
    });
  };

  /* ── Seating suggestion ────────────────────────────────────────────── */
  const [suggestion, setSuggestion] = useState<{ bookingId: string; data: SeatingSuggestion | null } | null>(null);
  const suggestMutation = useMutation({
    mutationFn: async (bookingId: string) =>
      (await api.get(`/events/${eventId}/seating/suggest`, { params: { booking_id: bookingId } })).data.data as SeatingSuggestion | null,
    onSuccess: (data, bookingId) => {
      setSuggestion({ bookingId, data });
      if (data) toast.success(`Suggested table ${data.table_number}`);
      else toast("No seating suggestion available yet");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /* ── Invoice ────────────────────────────────────────────────────────── */
  const [invoiceTarget, setInvoiceTarget] = useState<{ booking: Booking; invoice: BookingInvoice } | null>(null);
  const invoiceMutation = useMutation({
    mutationFn: async (bookingId: string) =>
      (await api.post(`/events/${eventId}/bookings/${bookingId}/invoice`)).data.data as BookingInvoice,
    onSuccess: (invoice, bookingId) => {
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking) setInvoiceTarget({ booking, invoice });
      qc.invalidateQueries({ queryKey: ["corporate-report", eventId] });
      toast.success(`Invoice ${invoice.invoice_number} ready`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /* ── Columns ───────────────────────────────────────────────────────── */
  const packageColumns: ColumnDef<Package>[] = [
    {
      key: "name", label: "Package", sortable: true,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{p.name}</p>
          {p.description && <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>}
        </div>
      ),
    },
    { key: "price_tsh", label: "Price", sortable: true, render: (p) => <span className="font-semibold text-slate-900">{formatTsh(p.price_tsh)}</span> },
    { key: "seats_per_table", label: "Seats / table", render: (p) => <span className="text-slate-600">{p.seats_per_table}</span> },
    {
      key: "is_active", label: "Status",
      render: (p) => <Badge label={p.is_active ? "active" : "inactive"} variant={p.is_active ? "green" : "slate"} />,
    },
    {
      key: "actions", label: " ",
      render: (p) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openPackageModal(p)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit package"><Pencil className="h-4 w-4" /></button>
          <button
            onClick={() => { if (window.confirm(`Delete package "${p.name}"?`)) deletePackageMutation.mutate(p.id); }}
            className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
            title="Delete package"
          ><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  const bookingColumns: ColumnDef<Booking>[] = [
    {
      key: "company_name", label: "Company / contact", sortable: true,
      render: (b) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{b.company_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{b.contact_person} · {b.contact_phone}</p>
          {(b.contact_email_is_free || !!b.contact_email_verified_at) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {b.contact_email_is_free && (
                <Badge label="Free-mail contact" className="!normal-case bg-amber-100 text-amber-800" />
              )}
              {!!b.contact_email_verified_at && (
                <Badge label="Email verified" className="!normal-case bg-emerald-100 text-emerald-700" />
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "packages", label: "Packages",
      render: (b) => b.packages.length ? (
        <div className="space-y-0.5 text-xs text-slate-600">
          {b.packages.map((p) => (
            <p key={p.package_id}>{p.name} × {p.quantity} <span className="text-slate-400">({formatTsh(p.price_tsh)} / seat)</span></p>
          ))}
        </div>
      ) : <span className="text-slate-400">—</span>,
    },
    { key: "total_amount", label: "Total", render: (b) => <span className="font-semibold text-slate-900">{formatTsh(b.total_amount)}</span> },
    { key: "amount_paid", label: "Paid", render: (b) => <span className="text-slate-600">{formatTsh(b.amount_paid)}</span> },
    {
      key: "balance", label: "Balance",
      render: (b) => <span className={b.balance > 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>{formatTsh(b.balance)}</span>,
    },
    {
      key: "workflow_status", label: "Workflow",
      render: (b) => {
        const index = workflowIndex(b.workflow_status);
        const step = WORKFLOW_STEPS[index];
        return (
          <div className="min-w-[130px] space-y-1.5">
            <Badge label={step.label} className={`!normal-case ${step.badgeClass}`} />
            <div
              className="flex gap-0.5"
              title={WORKFLOW_STEPS.map((s) => s.label).join(" → ")}
            >
              {WORKFLOW_STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1 flex-1 rounded-full ${
                    i < index ? "bg-gold-400" : i === index ? "bg-navy-800" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              {b.confirmed_at ? "Payment confirmed" : "Payment pending"}
            </p>
          </div>
        );
      },
    },
    { key: "passes_created", label: "Passes", render: (b) => <span className="text-slate-700">{b.passes_created}</span> },
    {
      key: "tables", label: "Tables",
      render: (b) => b.tables.length ? (
        <div className="flex flex-wrap gap-1">
          {b.tables.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              <Armchair className="h-3 w-3" /> {t.table_number}
              <button
                onClick={() => { if (window.confirm(`Remove table ${t.table_number}?`)) removeTableMutation.mutate({ bookingId: b.id, tableId: t.id }); }}
                className="text-slate-400 hover:text-rose-600"
                title="Remove table"
              ><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      ) : <span className="text-xs text-slate-400">None assigned</span>,
    },
    {
      key: "actions", label: " ",
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm" variant="ghost"
            className="text-sky-700"
            disabled={!!b.contact_email_verified_at || !b.contact_email}
            title={b.contact_email_verified_at ? "Email already verified" : !b.contact_email ? "Add a contact email first" : "Send verification email"}
            onClick={() => verifyMutation.mutate(b.id)}
            isLoading={verifyMutation.isPending && verifyMutation.variables === b.id}
          ><MailCheck className="h-3.5 w-3.5" /> Verify email</Button>
          {(b.workflow_status === "paid" || b.workflow_status === "requested") && (
            <Button
              size="sm" variant="ghost"
              className="text-navy-800"
              onClick={() => issuePassesMutation.mutate(b.id)}
              isLoading={issuePassesMutation.isPending && issuePassesMutation.variables === b.id}
              title="Issue passes for this booking"
            ><Ticket className="h-3.5 w-3.5" /> Issue passes</Button>
          )}
          {!!b.registration_token && (
            <>
              <Button
                size="sm" variant="ghost"
                className="text-gold-700"
                onClick={() => copyRegistrationLink(b.registration_token as string)}
                title="Copy registration link"
              ><Link2 className="h-3.5 w-3.5" /> Registration link</Button>
              <Button
                size="sm" variant="ghost"
                className="text-violet-700"
                onClick={() => resendMutation.mutate(b)}
                isLoading={resendMutation.isPending && resendMutation.variables?.id === b.id}
                title="Resend check-in credentials to the contact"
              ><Send className="h-3.5 w-3.5" /> Resend</Button>
              <Button
                size="sm" variant="ghost"
                className="text-slate-700"
                onClick={() => setPassesTarget(b)}
                title="View and manage passes"
              ><Users className="h-3.5 w-3.5" /> Passes</Button>
            </>
          )}
          <Button
            size="sm" variant="ghost"
            className="text-navy-800"
            onClick={() => openEditBookingModal(b)}
            title="Edit booking details"
          ><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button
            size="sm" variant="ghost"
            className="text-rose-600"
            onClick={() => {
              if (window.confirm(`Delete the booking for ${b.company_name}? This cannot be undone.`)) {
                deleteBookingMutation.mutate(b.id);
              }
            }}
            isLoading={deleteBookingMutation.isPending && deleteBookingMutation.variables === b.id}
            title="Delete booking"
          ><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <Button
            size="sm" variant="ghost"
            className="text-violet-700"
            onClick={() => regenerateTokenMutation.mutate(b)}
            isLoading={regenerateTokenMutation.isPending && regenerateTokenMutation.variables?.id === b.id}
            title="Generate a new registration link and copy it"
          ><RefreshCw className="h-3.5 w-3.5" /> Regenerate link</Button>
          <Button
            size="sm" variant="ghost"
            className="text-sky-700"
            onClick={() => openPassImportModal(b)}
            title="Import named guests from CSV or XLSX"
          ><Upload className="h-3.5 w-3.5" /> Import passes</Button>
          <Button
            size="sm" variant="ghost"
            className="text-emerald-700"
            disabled={!!b.confirmed_at}
            title={b.confirmed_at ? "Payment already confirmed" : "Confirm payment"}
            onClick={() => openConfirmModal(b)}
          ><CheckCircle2 className="h-3.5 w-3.5" /> Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => openTableModal(b)}><Armchair className="h-3.5 w-3.5" /> Add table</Button>
          <Button size="sm" variant="ghost" className="text-gold-700" onClick={() => suggestMutation.mutate(b.id)} isLoading={suggestMutation.isPending && suggestMutation.variables === b.id}>
            <Lightbulb className="h-3.5 w-3.5" /> Suggest
          </Button>
          <Button
            size="sm" variant="ghost" className="text-navy-700"
            onClick={() => invoiceMutation.mutate(b.id)}
            isLoading={invoiceMutation.isPending && invoiceMutation.variables === b.id}
            title="Generate or view invoice"
          ><FileText className="h-3.5 w-3.5" /> Invoice</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Packages ─────────────────────────────────────────────────── */}
      <Card
        title={`Packages (${packages.length})`}
        action={<Button size="sm" onClick={() => openPackageModal()}><Plus className="h-4 w-4" /> Add package</Button>}
      >
        <p className="mb-4 text-sm text-slate-500">
          Define the ticket packages corporate clients can book, including the price per seat and the number of seats at each table.
        </p>
        {packagesLoading ? (
          <p className="text-sm text-slate-500">Loading packages…</p>
        ) : packages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No packages yet</p>
            <p className="mt-1 text-sm text-slate-500">Add a package first — bookings need at least one package with a price and seats per table.</p>
          </div>
        ) : (
          <DataTable
            data={packages}
            columns={packageColumns}
            searchFields={["name", "description"]}
            searchPlaceholder="Search packages…"
            showCheckboxes={false}
            showFilters={false}
            emptyMessage="No packages match your search"
          />
        )}
      </Card>

      {/* ── Bookings ─────────────────────────────────────────────────── */}
      <Card
        title={`Bookings (${bookings.length})`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={openBookingImportModal} title="Import bookings from CSV or XLSX">
              <Upload className="h-4 w-4" /> Import bookings
            </Button>
            <Button size="sm" onClick={openBookingModal} disabled={packages.length === 0} title={packages.length === 0 ? "Add a package first" : "Create a booking"}>
              <Plus className="h-4 w-4" /> New booking
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-slate-500">
          Track company bookings, confirm payments, assign tables and generate passes. Confirming a booking creates the guest passes.
        </p>

        {suggestion && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm">
            <div>
              <p className="font-semibold text-navy-950">
                {suggestion.data ? `Seating suggestion — Table ${suggestion.data.table_number}` : "No seating suggestion available"}
              </p>
              {suggestion.data ? (
                <>
                  <p className="mt-1 text-slate-600">{suggestion.data.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">{suggestion.data.seated} of {suggestion.data.capacity} seats filled</p>
                </>
              ) : (
                <p className="mt-1 text-slate-600">Assign tables to this booking and seat its guests to get a suggestion.</p>
              )}
            </div>
            <button onClick={() => setSuggestion(null)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700" title="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        )}

        {bookingsLoading ? (
          <p className="text-sm text-slate-500">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No bookings yet</p>
            <p className="mt-1 text-sm text-slate-500">
              {packages.length === 0
                ? "Create a package above, then use “New booking” to register a company and its seats."
                : "Use “New booking” to register a company, select packages and confirm their payment."}
            </p>
          </div>
        ) : (
          <DataTable
            data={bookings}
            columns={bookingColumns}
            searchFields={["company_name", "contact_person", "contact_phone"]}
            searchPlaceholder="Search bookings…"
            showCheckboxes={false}
            showFilters={false}
            emptyMessage="No bookings match your search"
          />
        )}
      </Card>

      {/* ── Report ───────────────────────────────────────────────────── */}
      <Card
        title="Report"
        action={
          <Button size="sm" variant="ghost" onClick={() => refetchReport()} isLoading={reportLoading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      >
        {reportLoading && !report ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : !report ? (
          <p className="text-sm text-slate-400">No report data available.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard title="Bookings" value={report.total_bookings ?? 0} icon={Building2} color="blue" />
              <StatCard title="Confirmed" value={report.confirmed_bookings ?? 0} icon={CheckCircle2} color="green" />
              <StatCard title="Revenue" value={formatTsh(report.total_revenue ?? 0)} icon={Wallet} color="gold" />
              <StatCard title="Paid" value={formatTsh(report.total_paid ?? 0)} icon={Ticket} color="purple" />
              <StatCard title="Balance" value={formatTsh(report.total_balance ?? 0)} icon={FileText} color="red" />
              <StatCard
                title="Passes arrived"
                value={`${report.passes_arrived ?? 0} / ${report.total_passes ?? 0}`}
                icon={Users}
                color="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-bold text-navy-950">By package</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={thClass}>Package</th>
                        <th className={thClass}>Bookings</th>
                        <th className={thClass}>Seats</th>
                        <th className={thClass}>Passes</th>
                        <th className={thClass}>Arrived</th>
                        <th className={thClass}>Revenue</th>
                        <th className={thClass}>Paid</th>
                        <th className={thClass}>Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.by_package?.length ? report.by_package.map((row) => (
                        <tr key={row.package_id}>
                          <td className={`${tdClass} font-semibold text-slate-900`}>{row.name}</td>
                          <td className={tdClass}>{row.bookings}</td>
                          <td className={tdClass}>{row.seats}</td>
                          <td className={tdClass}>{row.passes}</td>
                          <td className={tdClass}>{row.arrived}</td>
                          <td className={tdClass}>{formatTsh(row.revenue)}</td>
                          <td className={tdClass}>{formatTsh(row.paid)}</td>
                          <td className={tdClass}>{formatTsh(row.balance)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-400">No package data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-bold text-navy-950">By company</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={thClass}>Company</th>
                        <th className={thClass}>Contact</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Total</th>
                        <th className={thClass}>Paid</th>
                        <th className={thClass}>Balance</th>
                        <th className={thClass}>Passes</th>
                        <th className={thClass}>Arrived</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.by_company?.length ? report.by_company.map((row) => (
                        <tr key={row.booking_id}>
                          <td className={`${tdClass} font-semibold text-slate-900`}>{row.company_name}</td>
                          <td className={tdClass}>{row.contact_person}</td>
                          <td className={tdClass}>
                            <Badge label={row.confirmed ? "confirmed" : "pending"} variant={row.confirmed ? "green" : "pending"} />
                          </td>
                          <td className={tdClass}>{formatTsh(row.total)}</td>
                          <td className={tdClass}>{formatTsh(row.paid)}</td>
                          <td className={tdClass}>{row.balance > 0 ? <span className="font-semibold text-rose-600">{formatTsh(row.balance)}</span> : formatTsh(row.balance)}</td>
                          <td className={tdClass}>{row.passes}</td>
                          <td className={tdClass}>{row.arrived}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-400">No company data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-navy-950">By table</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={thClass}>Table</th>
                      <th className={thClass}>Company / open</th>
                      <th className={thClass}>Capacity</th>
                      <th className={thClass}>Passes</th>
                      <th className={thClass}>Seated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.by_table?.length ? report.by_table.map((row) => (
                      <tr key={`${row.table_number}-${row.company_name ?? "open"}`}>
                        <td className={`${tdClass} font-semibold text-slate-900`}>{row.table_number}</td>
                        <td className={tdClass}>{row.company_name ?? <span className="text-slate-400">Open table</span>}</td>
                        <td className={tdClass}>{row.capacity}</td>
                        <td className={tdClass}>{row.passes}</td>
                        <td className={tdClass}>{row.seated}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">No tables assigned yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Package modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={packageModalOpen}
        onClose={() => setPackageModalOpen(false)}
        title={editingPackageId ? "Edit package" : "Add package"}
      >
        <form onSubmit={submitPackage} className="space-y-4">
          <Input label="Name" value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="e.g. VIP table" required />
          <div>
            <label htmlFor="package-description" className="mb-1 block text-xs font-semibold text-slate-600">Description (optional)</label>
            <textarea
              id="package-description" rows={2} value={packageForm.description}
              onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
              placeholder="What is included in this package"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Price per seat (TZS)" type="number" min={0} step={1} value={packageForm.price_tsh} onChange={(e) => setPackageForm({ ...packageForm, price_tsh: e.target.value })} placeholder="150000" required />
            <Input label="Seats per table" type="number" min={1} step={1} value={packageForm.seats_per_table} onChange={(e) => setPackageForm({ ...packageForm, seats_per_table: e.target.value })} required />
          </div>
          <Select
            label="Card template (optional)"
            value={packageForm.card_template_id}
            onChange={(e) => setPackageForm({ ...packageForm, card_template_id: e.target.value })}
          >
            <option value="">No card template</option>
            {cardTemplates.filter((t) => t.is_active !== false).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={packageForm.is_active} onChange={(e) => setPackageForm({ ...packageForm, is_active: e.target.checked })} className="h-4 w-4 accent-gold-500" />
            Package is active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPackageModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={savePackageMutation.isPending}>{editingPackageId ? "Save changes" : "Add package"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Booking modal ────────────────────────────────────────────── */}
      <Modal isOpen={bookingModalOpen} onClose={() => setBookingModalOpen(false)} title="New booking" size="lg">
        <form onSubmit={submitBooking} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Company name" value={bookingForm.company_name} onChange={(e) => setBookingForm({ ...bookingForm, company_name: e.target.value })} placeholder="Company Ltd" required />
            <Input label="Contact person" value={bookingForm.contact_person} onChange={(e) => setBookingForm({ ...bookingForm, contact_person: e.target.value })} placeholder="Full name" required />
            <Input label="Contact phone" value={bookingForm.contact_phone} onChange={(e) => setBookingForm({ ...bookingForm, contact_phone: e.target.value })} placeholder="07xxxxxxxx" required />
            <Input label="Contact email (optional)" type="email" value={bookingForm.contact_email} onChange={(e) => setBookingForm({ ...bookingForm, contact_email: e.target.value })} placeholder="name@company.com" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">Packages & quantities</label>
              <Button type="button" size="sm" variant="ghost" onClick={() => setBookingRows([...bookingRows, { package_id: "", quantity: "1" }])}>
                <Plus className="h-3.5 w-3.5" /> Add row
              </Button>
            </div>
            <div className="space-y-2">
              {bookingRows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_100px_auto] items-end gap-2">
                  <Select
                    label={index === 0 ? "Package" : undefined}
                    value={row.package_id}
                    onChange={(e) => setBookingRows(bookingRows.map((r, i) => i === index ? { ...r, package_id: e.target.value } : r))}
                  >
                    <option value="">Select package…</option>
                    {packages.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatTsh(p.price_tsh)}</option>
                    ))}
                  </Select>
                  <Input
                    label={index === 0 ? "Quantity" : undefined}
                    type="number" min={1} step={1} value={row.quantity}
                    onChange={(e) => setBookingRows(bookingRows.map((r, i) => i === index ? { ...r, quantity: e.target.value } : r))}
                  />
                  <button
                    type="button"
                    onClick={() => setBookingRows(bookingRows.length === 1 ? [{ package_id: "", quantity: "1" }] : bookingRows.filter((_, i) => i !== index))}
                    className="mb-1 rounded p-2 text-rose-600 hover:bg-rose-50"
                    title="Remove row"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">Quantity is the number of seats booked for that package.</p>
          </div>
          <div>
            <label htmlFor="booking-notes" className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
            <textarea
              id="booking-notes" rows={2} value={bookingForm.notes}
              onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
              placeholder="Internal notes about this booking"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setBookingModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createBookingMutation.isPending}>Create booking</Button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm payment modal ────────────────────────────────────── */}
      <Modal isOpen={!!confirmTarget} onClose={() => setConfirmTarget(null)} title={`Confirm payment — ${confirmTarget?.company_name ?? ""}`}>
        <form onSubmit={submitConfirm} className="space-y-4">
          {confirmTarget && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Total <span className="font-semibold text-slate-900">{formatTsh(confirmTarget.total_amount)}</span> · Outstanding <span className="font-semibold text-rose-600">{formatTsh(confirmTarget.balance)}</span>
            </div>
          )}
          <Input label="Payment reference" value={confirmForm.payment_reference} onChange={(e) => setConfirmForm({ ...confirmForm, payment_reference: e.target.value })} placeholder="M-Pesa code / receipt" />
          <Input label="Amount paid (TZS)" type="number" min={0} step={1} value={confirmForm.amount_paid} onChange={(e) => setConfirmForm({ ...confirmForm, amount_paid: e.target.value })} placeholder="Leave blank to keep current amount" />
          <Input label="Proof file ID (optional)" value={confirmForm.proof_file_id} onChange={(e) => setConfirmForm({ ...confirmForm, proof_file_id: e.target.value })} placeholder="Uploaded proof document ID" />
          <div>
            <label htmlFor="confirm-notes" className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
            <textarea
              id="confirm-notes" rows={2} value={confirmForm.notes}
              onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
            />
          </div>
          <p className="text-xs text-slate-500">Confirming creates the guest passes for this booking and cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={confirmMutation.isPending}><CheckCircle2 className="h-4 w-4" /> Confirm payment</Button>
          </div>
        </form>
      </Modal>

      {/* ── Invoice modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title={`Invoice — ${invoiceTarget?.invoice.invoice_number ?? ""}`}
        size="lg"
      >
        {invoiceTarget && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Invoice number</p>
                <p className="mt-1 text-lg font-bold text-navy-950">{invoiceTarget.invoice.invoice_number}</p>
              </div>
              <Badge
                label={invoiceTarget.invoice.status}
                variant={invoiceTarget.invoice.status === "paid" ? "green" : "slate"}
              />
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Company</dt>
                <dd className="font-semibold text-slate-900">{invoiceTarget.booking.company_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Event</dt>
                <dd className="font-semibold text-slate-900">{eventId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Amount</dt>
                <dd className="font-semibold text-slate-900">{formatTsh(invoiceTarget.invoice.amount_tsh)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Tax rate</dt>
                <dd className="text-slate-700">
                  {invoiceTarget.invoice.tax_rate_percent}%
                  {invoiceTarget.invoice.tax_inclusive ? " (inclusive)" : " (exclusive)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Tax amount</dt>
                <dd className="text-slate-700">{formatTsh(invoiceTarget.invoice.tax_amount_tsh)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">TIN</dt>
                <dd className="text-slate-700">{invoiceTarget.invoice.tin || "not configured"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="text-slate-700">{invoiceTarget.invoice.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Issued</dt>
                <dd className="text-slate-700">
                  {invoiceTarget.invoice.issued_at
                    ? new Date(invoiceTarget.invoice.issued_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
            {invoiceTarget.invoice.notes && (
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                {invoiceTarget.invoice.notes}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setInvoiceTarget(null)}>Close</Button>
              <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Passes modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!passesTarget}
        onClose={() => setPassesTarget(null)}
        title={`Passes — ${passesTarget?.company_name ?? ""}`}
        size="lg"
      >
        {passesTarget && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                {passesTarget.passes_created} pass{passesTarget.passes_created === 1 ? "" : "es"} for this booking
              </p>
              <Button
                size="sm" variant="ghost"
                onClick={() => resendMutation.mutate(passesTarget)}
                isLoading={resendMutation.isPending}
                disabled={!passInfo?.passes?.length}
              ><Send className="h-3.5 w-3.5" /> Resend credentials</Button>
            </div>
            {passesLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading passes…</p>
            ) : !(passInfo?.passes?.length) ? (
              <p className="py-6 text-center text-sm text-slate-400">No passes issued yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {passInfo.passes.map((pass) => (
                  <li key={pass.guest_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{pass.full_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {pass.package_name ?? "Package —"}
                        {pass.table_number ? ` · Table ${pass.table_number}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={pass.pass_state} className={passStateStyle(pass.pass_state)} />
                      <Button
                        size="sm" variant="ghost"
                        className="text-rose-600"
                        disabled={pass.pass_state === "revoked"}
                        onClick={() => {
                          if (window.confirm(`Revoke the pass for ${pass.full_name}?`)) {
                            revokeMutation.mutate({ bookingId: passesTarget.id, guestId: pass.guest_id });
                          }
                        }}
                        isLoading={revokeMutation.isPending && revokeMutation.variables?.guestId === pass.guest_id}
                      ><Ban className="h-3.5 w-3.5" /> Revoke</Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-navy-800"
                        onClick={() => openReassignModal(passesTarget.id, pass)}
                      ><Pencil className="h-3.5 w-3.5" /> Reassign</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* ── Reassign pass modal ──────────────────────────────────────── */}
      <Modal
        isOpen={!!reassignTarget}
        onClose={() => setReassignTarget(null)}
        title={`Reassign pass — ${reassignTarget?.pass.full_name ?? ""}`}
      >
        <form onSubmit={submitReassign} className="space-y-4">
          <Input
            label="Full name"
            value={reassignForm.full_name}
            onChange={(e) => setReassignForm({ ...reassignForm, full_name: e.target.value })}
            placeholder="Attendee full name"
            required
          />
          <Input
            label="Phone"
            value={reassignForm.phone}
            onChange={(e) => setReassignForm({ ...reassignForm, phone: e.target.value })}
            placeholder="07xxxxxxxx"
            required
          />
          <Input
            label="Email (optional)"
            type="email"
            value={reassignForm.email}
            onChange={(e) => setReassignForm({ ...reassignForm, email: e.target.value })}
            placeholder="name@example.com"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={reassignMutation.isPending}><Pencil className="h-4 w-4" /> Reassign pass</Button>
          </div>
        </form>
      </Modal>

      {/* ── Add table modal ──────────────────────────────────────────── */}
      <Modal isOpen={!!tableTarget} onClose={() => setTableTarget(null)} title={`Add table — ${tableTarget?.company_name ?? ""}`}>
        <form onSubmit={submitTable} className="space-y-4">
          <Input label="Table number" value={tableForm.table_number} onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })} placeholder="e.g. 12" required />
          <Select label="Package (optional)" value={tableForm.package_id} onChange={(e) => setTableForm({ ...tableForm, package_id: e.target.value })}>
            <option value="">No specific package</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setTableTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={addTableMutation.isPending}><Armchair className="h-4 w-4" /> Add table</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit booking modal ────────────────────────────────────────── */}
      <Modal
        isOpen={!!editBookingTarget}
        onClose={() => setEditBookingTarget(null)}
        title={`Edit booking — ${editBookingTarget?.company_name ?? ""}`}
        size="lg"
      >
        <form onSubmit={submitEditBooking} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="edit-company-name" label="Company name"
              value={editBookingForm.company_name}
              onChange={(e) => setEditBookingForm({ ...editBookingForm, company_name: e.target.value })}
              required
            />
            <Input
              id="edit-contact-person" label="Contact person"
              value={editBookingForm.contact_person}
              onChange={(e) => setEditBookingForm({ ...editBookingForm, contact_person: e.target.value })}
              required
            />
            <Input
              id="edit-contact-phone" label="Contact phone"
              value={editBookingForm.contact_phone}
              onChange={(e) => setEditBookingForm({ ...editBookingForm, contact_phone: e.target.value })}
              required
            />
            <Input
              id="edit-contact-email" label="Contact email (optional)" type="email"
              value={editBookingForm.contact_email}
              onChange={(e) => setEditBookingForm({ ...editBookingForm, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="edit-booking-notes" className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
            <textarea
              id="edit-booking-notes" rows={2} value={editBookingForm.notes}
              onChange={(e) => setEditBookingForm({ ...editBookingForm, notes: e.target.value })}
              placeholder="Internal notes about this booking"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditBookingTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={updateBookingMutation.isPending}>Save changes</Button>
          </div>
        </form>
      </Modal>

      {/* ── Regenerated registration link modal ───────────────────────── */}
      <Modal
        isOpen={!!regeneratedLink}
        onClose={() => setRegeneratedLink(null)}
        title="Registration link regenerated"
      >
        {regeneratedLink && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              New registration token for <span className="font-semibold text-slate-900">{regeneratedLink.company}</span>. The link below was copied to your clipboard.
            </p>
            <div className="break-words rounded-lg bg-slate-50 p-3 font-mono text-sm text-navy-950">{regeneratedLink.token}</div>
            <p className="break-words text-xs text-slate-500">{regeneratedLink.url}</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setRegeneratedLink(null)}>Close</Button>
              <Button onClick={() => copyRegistrationLink(regeneratedLink.token)}><Link2 className="h-4 w-4" /> Copy link</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Import bookings modal ─────────────────────────────────────── */}
      <Modal
        isOpen={bookingImportOpen}
        onClose={() => setBookingImportOpen(false)}
        title="Import bookings"
        size="lg"
      >
        <div className="space-y-4">
          <p className="break-words text-sm text-slate-600">
            Upload a CSV or XLSX file with columns: company_name, contact_person, contact_phone, contact_email, package_name, quantity, notes.
          </p>
          <Input
            type="file" accept=".csv,.xlsx,.xls" label="Bookings file"
            onChange={(e) => setBookingImportFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBookingImportOpen(false)}>Cancel</Button>
            <Button
              disabled={!bookingImportFile}
              isLoading={importBookingsMutation.isPending}
              onClick={() => { if (bookingImportFile) importBookingsMutation.mutate(bookingImportFile); }}
            ><Upload className="h-4 w-4" /> Import</Button>
          </div>
          {bookingImportResult && <ImportResultPanel result={bookingImportResult} />}
        </div>
      </Modal>

      {/* ── Import passes modal ───────────────────────────────────────── */}
      <Modal
        isOpen={!!passImportTarget}
        onClose={() => setPassImportTarget(null)}
        title={`Import passes — ${passImportTarget?.company_name ?? ""}`}
        size="lg"
      >
        {passImportTarget && (
          <div className="space-y-4">
            <p className="break-words text-sm text-slate-600">
              Upload a CSV or XLSX file with columns: full_name, phone, email, table_number, guest_category, package_name.
            </p>
            <Input
              type="file" accept=".csv,.xlsx,.xls" label="Passes file"
              onChange={(e) => setPassImportFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPassImportTarget(null)}>Cancel</Button>
              <Button
                disabled={!passImportFile}
                isLoading={importPassesMutation.isPending}
                onClick={() => { if (passImportFile) importPassesMutation.mutate({ bookingId: passImportTarget.id, file: passImportFile }); }}
              ><Upload className="h-4 w-4" /> Import</Button>
            </div>
            {passImportResult && <ImportResultPanel result={passImportResult} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
