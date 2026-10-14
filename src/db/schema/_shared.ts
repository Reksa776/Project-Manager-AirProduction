import { timestamp } from "drizzle-orm/pg-core";

/** UTC timestamps shared by every PostgreSQL record table. */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "string", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", precision: 3 })
      .notNull()
      .defaultNow(),
  };
}
