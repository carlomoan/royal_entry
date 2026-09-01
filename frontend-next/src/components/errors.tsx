import Link from "next/link";
import { Home, ArrowLeft, AlertTriangle, ShieldX, Lock, Search, ServerCrash } from "lucide-react";

interface ErrorPageProps {
  code: string;
  title: string;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

function ErrorLayout({ code, title, message, icon: Icon, accentColor }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="text-center animate-fadeIn">
        {/* Large code */}
        <div className={`relative inline-block`}>
          <p className={`text-[140px] font-black leading-none tracking-tighter opacity-15 ${accentColor}`}>
            {code}
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg ${accentColor.replace("text-", "bg-").replace("/20", "/10")}`}>
              <Icon className={`h-10 w-10 ${accentColor}`} />
            </div>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {message}
        </p>

        {/* Decorative line */}
        <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold-400" />

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-950 shadow-sm transition hover:bg-gold-600"
          >
            <Home className="h-4 w-4" /> Back to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          RoyalEntry · Elite Access Solutions
        </p>
      </div>
    </div>
  );
}

/* ── 400 Bad Request ──────────────────────────────────────────────────── */
export function BadRequestPage() {
  return (
    <ErrorLayout
      code="400"
      title="Bad Request"
      message="The request could not be understood by the server due to malformed syntax. Please check your input and try again."
      icon={AlertTriangle}
      accentColor="text-amber-500"
    />
  );
}

/* ── 401 Unauthorized ─────────────────────────────────────────────────── */
export function UnauthorizedPage() {
  return (
    <ErrorLayout
      code="401"
      title="Unauthorized"
      message="You need to sign in to access this page. Your session may have expired."
      icon={Lock}
      accentColor="text-sky-500"
    />
  );
}

/* ── 403 Forbidden ────────────────────────────────────────────────────── */
export function ForbiddenPage() {
  return (
    <ErrorLayout
      code="403"
      title="Access Denied"
      message="You don't have permission to access this resource. Contact your administrator if you believe this is an error."
      icon={ShieldX}
      accentColor="text-rose-500"
    />
  );
}

/* ── 404 Not Found ────────────────────────────────────────────────────── */
export function NotFoundPage() {
  return (
    <ErrorLayout
      code="404"
      title="Page Not Found"
      message="Sorry, we couldn't find the page you're looking for. It may have been moved or deleted."
      icon={Search}
      accentColor="text-gold-500"
    />
  );
}

/* ── 500 Internal Server Error ────────────────────────────────────────── */
export function ServerErrorPage() {
  return (
    <ErrorLayout
      code="500"
      title="Something Went Wrong"
      message="An unexpected server error occurred. Our team has been notified. Please try again later."
      icon={ServerCrash}
      accentColor="text-red-500"
    />
  );
}