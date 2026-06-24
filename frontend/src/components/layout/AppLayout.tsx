// ==============================================================================
// FILE: src/components/layout/AppLayout.tsx
// ==============================================================================

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,168,76,0.14),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-4 p-3 md:p-4">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/55 shadow-2xl shadow-slate-200/60 backdrop-blur-xl">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8 md:pt-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
