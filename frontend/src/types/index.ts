// ==============================================================================
// FILE: src/types/index.ts
// ==============================================================================
// All shared TypeScript types — mirrors the Rust backend models

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ── Events ───────────────────────────────────────────────────────────────────

export type EventStatus =
  | "draft"
  | "approved"
  | "active"
  | "completed"
  | "cancelled";

export interface Event {
  id: string;
  title: string;
  description?: string;
  event_date: string; // YYYY-MM-DD
  event_time?: string;
  venue_name?: string;
  venue_address?: string;
  dress_code?: string;
  status: EventStatus;
  guest_count_expected?: number;
  rsvp_deadline?: string;
  card_theme?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  venue_name?: string;
  venue_address?: string;
  dress_code?: string;
  card_theme?: string;
  guest_count_expected?: number;
  rsvp_deadline?: string;
}

export interface EventSummary {
  event: Event;
  summary: {
    total_guests: number;
    guests_arrived: number;
    rsvp_confirmed: number;
    rsvp_declined: number;
    invitations_sent: number;
    michango_collected_tsh: number;
  };
}

// ── Guests ───────────────────────────────────────────────────────────────────

export type GuestCategory = "VIP" | "Regular" | "Staff" | "Family" | "Friend";

export interface Guest {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  table_number?: string;
  guest_category?: GuestCategory;
  plus_one_allowed: boolean;
  contact_method: string;
  created_at: string;
}

export interface GuestWithRsvp extends Guest {
  rsvp_response?: "confirmed" | "declined" | "pending";
  rsvp_responded_at?: string;
}

export interface CreateGuestInput {
  full_name: string;
  phone: string;
  email?: string;
  table_number?: string;
  guest_category?: GuestCategory;
  plus_one_allowed?: boolean;
  contact_method?: string;
}

// ── Invitations ───────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  guest_id: string;
  short_link: string;
  scan_url: string;
  status: "pending" | "sent" | "viewed" | "scanned" | "expired";
  scan_count: number;
  invitation_sent_at?: string;
  created_at: string;
}

export interface GenerateResult {
  generated: number;
  skipped: number;
  failed: number;
  invitations: Invitation[];
}

// ── Scan stats ────────────────────────────────────────────────────────────────

export interface ScanStats {
  total_guests: number;
  arrived: number;
  pending: number;
  arrival_rate_percent: number;
  timeline: { hour: string; count: number }[];
}

export interface ScanCheckInResult {
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  invitation_id: string;
  scanned_at: string;
  status: string;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  payment_type: string;
  package_name?: string;
  amount_tsh: number;
  payment_method: string;
  mpesa_receipt_number?: string;
  payer_phone?: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  completed_at?: string;
  created_at: string;
}

// ── Michango ──────────────────────────────────────────────────────────────────

export type PledgeStatus = "pending" | "partial" | "paid" | "overdue";

export interface Pledge {
  id: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  pledged_amount: number;
  amount_paid: number;
  remaining_amount: number;
  payment_status: PledgeStatus;
  payment_deadline?: string;
  reminder_count: number;
  last_reminder_sent_at?: string;
  notes?: string;
  created_at: string;
}

export interface MichangoSummary {
  total_pledgers: number;
  total_pledged_tsh: number;
  total_collected_tsh: number;
  total_outstanding_tsh: number;
  collection_rate_percent: number;
  pending_count: number;
  partial_count: number;
  paid_count: number;
  overdue_count: number;
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  campaign_name?: string;
  message_channel: string;
  target_audience: string;
  status: string;
  total_recipients?: number;
  successfully_sent: number;
  failed_count: number;
  sent_at?: string;
  created_at: string;
}

export interface BroadcastDelivery {
  id: string;
  campaign_id: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  channel: string;
  status: string;
  provider_message_id?: string;
  error_message?: string;
  delivered_at: string;
}

export interface ReminderDelivery {
  id: string;
  pledge_id: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  channel: string;
  status: string;
  provider_message_id?: string;
  error_message?: string;
  message: string;
  delivered_at: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
