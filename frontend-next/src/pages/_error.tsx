import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  BadRequestPage,
  UnauthorizedPage,
  ForbiddenPage,
  NotFoundPage,
  ServerErrorPage,
} from "@/components/errors";
import { Button } from "@/components/ui";
import { RefreshCw, Home } from "lucide-react";

interface ErrorProps {
  statusCode?: number;
}

function ErrorContent({ statusCode }: { statusCode: number }) {
  switch (statusCode) {
    case 400: return <BadRequestPage />;
    case 401: return <UnauthorizedPage />;
    case 403: return <ForbiddenPage />;
    case 404: return <NotFoundPage />;
    default: return <ServerErrorPage />;
  }
}

export default function GlobalError({ statusCode }: ErrorProps) {
  const code = statusCode ?? 500;

  // Client-side error handling when no statusCode (JS runtime error)
  if (!statusCode) {
    return (
      <ClientErrorBoundary />
    );
  }

  return (
    <>
      <ErrorContent statusCode={code} />
      {(code >= 500 || code === 400) && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center">
          <Button variant="ghost" onClick={() => window.location.reload()} className="shadow-md">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      )}
    </>
  );
}

function ClientErrorBoundary() {
  const router = useRouter();
  useEffect(() => {
    // client-side error logging could go here
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="text-center animate-fadeIn">
        <p className="text-[140px] font-black leading-none tracking-tighter text-red-500/15">ERR</p>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Something Went Wrong</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          An unexpected application error occurred. Please try again.
        </p>
        <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold-400" />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-2">
            <Home className="h-4 w-4" /> Dashboard
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()} className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

GlobalError.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode ?? 500 : 404;
  return { statusCode };
};