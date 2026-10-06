"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  adminName,
  children,
}: {
  adminName: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-full">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[#101828]/50"
            role="presentation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu navigasi"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-[#8896ab] transition-colors hover:bg-sidebar-hover hover:text-white"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <Topbar adminName={adminName} onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
