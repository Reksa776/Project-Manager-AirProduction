import { pgTable, text, varchar } from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";

/**
 * clients — master client.
 * Field baru sesuai requirement form: company_name, email, client_type
 * (belum pernah terpersist di Google Sheets → NULL saat migrasi).
 * phone berasal dari kolom sheet `contact` lama.
 */
export const clients = pgTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  cpw: varchar("cpw", { length: 120 }),
  cpp: varchar("cpp", { length: 120 }),
  companyName: varchar("company_name", { length: 120 }),
  contactPerson: varchar("contact_person", { length: 120 }),
  phone: varchar("phone", { length: 120 }),
  email: varchar("email", { length: 190 }),
  address: text("address"),
  clientType: varchar("client_type", { length: 32 }),
  notes: text("notes"),
  ...timestamps(),
});
