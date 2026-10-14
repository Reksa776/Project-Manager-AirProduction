import {
  boolean,
  integer,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";

/**
 * crew_roles — daftar role/profesi crew (ternormalisasi, dikelola dari aplikasi).
 * Role dinonaktifkan lewat is_active (bukan dihapus) agar riwayat job tetap utuh.
 */
export const crewRoles = pgTable(
  "crew_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => ({
    uqName: uniqueIndex("uq_crew_roles_name").on(t.name),
  }),
);
