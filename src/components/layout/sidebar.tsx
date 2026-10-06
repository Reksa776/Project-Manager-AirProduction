"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-[#cbd3e1]">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-line px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          AP
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Air Production</p>
          <p className="text-[11px] uppercase tracking-wider text-[#7d8aa0]">
            Production DB
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6b7a90]">
          Menu Utama
        </p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-white"
                  : "text-[#cbd3e1] hover:bg-sidebar-hover hover:text-white",
              )}
            >
              <Icon
                name={item.icon}
                className={cn(
                  "h-[18px] w-[18px]",
                  active ? "text-white" : "text-[#8896ab] group-hover:text-white",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-line px-5 py-4">
        <p className="text-[11px] text-[#6b7a90]">
          Air Production DB · Prototype
        </p>
        <p className="text-[11px] text-[#6b7a90]">Data sumber: mock</p>
      </div>
    </div>
  );
}
