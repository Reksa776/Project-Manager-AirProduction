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
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-[12px] font-semibold text-white">
          AP
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Air Production
          </p>
          <p className="text-[11px] text-ink-muted">Production DB</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-6">
        <p className="px-3 pb-2 text-[11px] font-medium text-ink-muted">
          Menu Utama
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
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors",
                    active
                      ? "bg-[#f5f5f5] font-medium text-ink"
                      : "text-ink-soft hover:bg-[#fafafa] hover:text-ink",
                  )}
                >
                  <Icon
                    name={item.icon}
                    className={cn(
                      "h-[17px] w-[17px] shrink-0",
                      active ? "text-ink" : "text-ink-muted",
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
          Prototype · data mock
        </p>
      </div>
    </div>
  );
}
