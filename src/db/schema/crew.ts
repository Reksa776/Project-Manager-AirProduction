import { numeric, pgTable, text, varchar } from "drizzle-orm/pg-core";

import { crewRoles } from "./crew-roles";
import { timestamps } from "./_shared";

/**
 * crew — master crew.
 * `crewRoleId` = profesi default (NOT NULL, RESTRICT agar riwayat tidak rusak).
 * Payment aktual TIDAK di sini: uang bergerak lewat cashflows (phase berikutnya).
 */
export const crew = pgTable("crew", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  crewRoleId: varchar("crew_role_id", { length: 36 })
    .notNull()
    .references(() => crewRoles.id, { onDelete: "restrict" }),
  defaultPayment: numeric("default_payment", {
    precision: 15,
    scale: 2,
    mode: "string",
  })
    .notNull()
    .default("0.00"),
  phone: varchar("phone", { length: 120 }),
  notes: text("notes"),
  ...timestamps(),
});
