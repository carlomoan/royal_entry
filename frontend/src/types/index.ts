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

export interface PlatformSummary {
  total_customers: number;
  active_customers: number;
  suspended_customers: number;
  total_users: number;
  active_events: number;
  total_revenue_tsh: number;
  pending_payments: number;
  active_subscriptions: number;
  past_due_subscriptions: number;
  monthly_recurring_revenue_tsh: number;
}

export interface PlatformCustomer {
  organization_id: string;
  display_name: string;
  admin_email: string;
  account_status: string;
  users_count: number;
  events_count: number;
  active_events_count: number;
  total_payments_count: number;
  completed_payments_count: number;
  total_revenue_tsh: number;
  last_payment_at?: string;
  last_activity_at?: string;
  current_plan_name?: string;
  subscription_status?: string;
  subscription_period_end?: string;
}

export interface PlatformCustomerUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface PlatformCustomerPayment {
  id: string;
  package_name?: string;
  amount_tsh: number;
  payment_method: string;
  payer_phone?: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_tsh: number;
  billing_interval: string;
  max_users?: number | null;
  max_events?: number | null;
  is_active: boolean;
}

export interface PlatformSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  price_tsh: number;
  billing_interval: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
}

export interface PlatformInvoice {
  id: string;
  invoice_number: string;
  plan_name?: string;
  amount_tsh: number;
  status: string;
  issued_at: string;
  due_at?: string;
  paid_at?: string;
  period_start?: string;
  period_end?: string;
  notes?: string;
}

export interface PlatformCustomerDetail {
  customer: PlatformCustomer;
  users: PlatformCustomerUser[];
  recent_payments: PlatformCustomerPayment[];
  current_subscription?: PlatformSubscription | null;
  recent_invoices: PlatformInvoice[];
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
  entry_start_time?: string;
  entry_end_time?: string;
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
  public_url: string;
  scan_url: string;
  scan_payload: string;
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

export interface PublicInvitationData {
  invitation: {
    id: string;
    short_link: string;
    status: string;
    scan_count: number;
    invitation_sent_at?: string;
    last_scanned_at?: string;
    created_at: string;
    public_url: string;
    scan_url: string;
    scan_payload: string;
  };
  guest: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
    table_number?: string;
    guest_category?: string;
    plus_one_allowed: boolean;
    contact_method: string;
  };
  event: {
    id: string;
    title: string;
    description?: string;
    event_date: string;
    event_time?: string;
    venue_name?: string;
    venue_address?: string;
    dress_code?: string;
    card_theme?: string;
    rsvp_deadline?: string;
    entry_start_time?: string;
    entry_end_time?: string;
  };
  rsvp: {
    response: string;
    responded_at?: string;
  };
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

// ── Reports ───────────────────────────────────────────────────────────────────

export interface ReportSummary {
  total_events: number;
  total_guests: number;
  total_arrivals: number;
  total_payments_tsh: number;
  total_michango_tsh: number;
  total_broadcasts: number;
}

export type ReportKind =
  | "events"
  | "guests"
  | "payments"
  | "michango"
  | "broadcasts";

export interface ReportExport {
  filename: string;
  content: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  occurred_at: string;
  user_id?: string;
  organization_id?: string;
  user_email?: string;
  role?: string;
  method: string;
  path: string;
  action: string;
  status_code: number;
  target_resource_type?: string;
  target_resource_id?: string;
}

export interface AuditQuery {
  page?: number;
  per_page?: number;
  organization_id?: string;
  action?: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface OrganizationProfile {
  id: string;
  display_name: string;
  account_slug?: string;
  billing_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRoleOption {
  key: string;
  label: string;
  scope: "platform" | "account";
}

export interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AccountSettingsResponse {
  organization: OrganizationProfile;
  settings: Record<string, unknown>;
  users: TeamMember[];
  role_catalog: UserRoleOption[];
}

export interface CreateAccountUserInput {
  organization_id?: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: string;
}

export interface UpdateAccountUserInput {
  organization_id?: string;
  role?: string;
  is_active?: boolean;
  full_name?: string;
  phone?: string;
}
