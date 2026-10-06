import type { IconName } from "@/components/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

/** Menu sidebar utama. Hanya berisi fitur yang sudah direncanakan. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Jobs", href: "/jobs", icon: "jobs" },
  { label: "Clients", href: "/clients", icon: "clients" },
  { label: "Vendors", href: "/vendors", icon: "vendors" },
  { label: "Crew", href: "/crew", icon: "crew" },
  { label: "Venues", href: "/venues", icon: "venues" },
  { label: "Finance", href: "/finance", icon: "finance" },
];
