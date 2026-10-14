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
    <div className="flex h-full flex-col border-r border-line bg-panel">
      <div className="flex h-[68px] items-center gap-3 border-b border-line px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-[12px] font-semibold tracking-wide text-brand ring-1 ring-[#a64f611a]">
          AP
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Air Production
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Wedding & Event Organizer
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-6">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
          Menu utama
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] transition-colors",
                    active
                      ? "bg-brand-soft font-semibold text-brand"
                      : "text-ink-soft hover:bg-app hover:text-ink",
                  )}
                >
                  <Icon
                    name={item.icon}
                    className={cn(
                      "h-[17px] w-[17px] shrink-0",
                      active ? "text-brand" : "text-ink-muted",
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Satu ruang untuk jadwal, tim, dan anggaran acara.
        </p>
      </div>
    </div>
  );
}
