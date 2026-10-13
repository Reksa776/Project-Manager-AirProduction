import { pgTable, decimal, text, varchar } from "drizzle-orm/pg-core";

/**
 * crew — master crew.
 * `crewRoleId` = profesi default (NOT NULL, RESTRICT agar riwayat tidak rusak).
 * Payment aktual TIDAK disini: uang bergerak lewat cashflows (Phase selanjutnya).
 */
export const crew = pgTable("crew", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  crewRoleId: varchar("crew_role_id", { length: 36 }).notNull().references(() => crewRoles.id, { onDelete: "restrict" }),
  defaultPayment: decimal("default_payment", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
  phone: varchar("phone", { length: 120 }),
  notes: text("notes"),
  ...timestamps(),
});