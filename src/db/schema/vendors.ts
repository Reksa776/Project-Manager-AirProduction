import { pgTable, text, varchar } from "drizzle-orm/pg-core";

/**
 * vendors — master vendor (counterparty job).
 */
export const vendors = pgTable("vendors", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  contactPerson: varchar("contact_person", { length: 120 }),
  phone: varchar("phone", { length: 120 }),
  email: varchar("email", { length: 190 }),
  notes: text("notes"),
  ...timestamps(),
});