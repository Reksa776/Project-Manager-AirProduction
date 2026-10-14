import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";

/** Package catalog offered to clients through the public intake form. */
export const packages = pgTable(
  "packages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (table) => ({
    uqName: uniqueIndex("uq_packages_name").on(table.name),
  }),
);
