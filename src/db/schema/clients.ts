import { date, pgTable, text, varchar } from "drizzle-orm/pg-core";

import { packages } from "./packages";
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
  nickname: varchar("nickname", { length: 120 }),
  instagram: varchar("instagram", { length: 120 }),
  cpwNickname: varchar("cpw_nickname", { length: 120 }),
  cpwInstagram: varchar("cpw_instagram", { length: 120 }),
  cppNickname: varchar("cpp_nickname", { length: 120 }),
  cppInstagram: varchar("cpp_instagram", { length: 120 }),
  cpw: varchar("cpw", { length: 120 }),
  cpp: varchar("cpp", { length: 120 }),
  companyName: varchar("company_name", { length: 120 }),
  contactPerson: varchar("contact_person", { length: 120 }),
  phone: varchar("phone", { length: 120 }),
  email: varchar("email", { length: 190 }),
  address: text("address"),
  clientType: varchar("client_type", { length: 32 }),
  notes: text("notes"),
  eventDate: date("event_date", { mode: "string" }),
  packageId: varchar("package_id", { length: 36 }).references(() => packages.id, { onDelete: "set null" }),
  ...timestamps(),
});
