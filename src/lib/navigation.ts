import type { IconName } from "@/components/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

/**
 * Menu sidebar utama.
 *
 * P0E-1B: entri **Venues dihapus** — venue bukan entity pada domain kanonik
 * (MySQL tidak memiliki tabel `venues`). No tautan navigasi rusak yang
 * ditinggalkan; histori nama venue disimpan di `jobs.legacy_venue_name`.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "Jobs", href: "/jobs", icon: "jobs" },
  { label: "Clients", href: "/clients", icon: "clients" },
  { label: "Packages", href: "/packages", icon: "inbox" },
  { label: "Vendors", href: "/vendors", icon: "vendors" },
  { label: "Crew", href: "/crew", icon: "crew" },
  { label: "Finance", href: "/finance", icon: "finance" },
];
