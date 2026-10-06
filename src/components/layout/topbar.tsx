"use client";

import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { NAV_ITEMS } from "@/lib/navigation";

function resolveSection(pathname: string): string {
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Buka menu navigasi"
        className="-ml-1 rounded-lg p-2 text-ink-soft transition-colors hover:bg-app hover:text-ink lg:hidden"
      >
        <Icon name="menu" />
      </button>

      <p className="flex-1 truncate text-[13px] text-ink-soft">
        {resolveSection(pathname)}
      </p>

      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f0f0] text-[12px] font-medium text-ink-soft">
          {adminName.charAt(0).toUpperCase()}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-[13px] font-medium text-ink">{adminName}</p>
          <p className="text-[11px] text-ink-muted">Admin</p>
        </div>
      </div>
    </header>
  );
}
