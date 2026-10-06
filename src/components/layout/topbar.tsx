"use client";

import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { NAV_ITEMS } from "@/lib/navigation";

function resolveTitle(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Air Production DB";
}

export function Topbar({
  adminName,
  onMenuClick,
}: {
  adminName: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-panel/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Buka menu navigasi"
        className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-app hover:text-ink lg:hidden"
      >
        <Icon name="menu" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {resolveTitle(pathname)}
        </p>
        <p className="hidden text-xs text-ink-muted sm:block">
          Sistem manajemen operasional production &amp; documentation
        </p>
      </div>

      <button
        type="button"
        aria-label="Notifikasi"
        className="hidden rounded-lg p-2 text-ink-muted transition-colors hover:bg-app hover:text-ink sm:inline-flex"
      >
        <Icon name="bell" />
      </button>

      <div className="flex items-center gap-3 border-l border-line pl-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {adminName.charAt(0).toUpperCase()}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-medium text-ink">{adminName}</p>
          <p className="text-xs text-ink-muted">Admin</p>
        </div>
      </div>
    </header>
  );
}
