import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db/env";

/**
 * Konfigurasi Drizzle Kit untuk schema target Supabase PostgreSQL.
 *
 * - Kredensial diambil dari DATABASE_URL (env), tidak pernah di-hardcode
 *   dan tidak pernah dicetak ke output.
 * - `schema`  : barrel seluruh tabel PostgreSQL (src/db/schema).
 * - `out`     : folder migrasi Supabase yang terpisah dari migrasi MySQL lama.
 * - `dialect` : postgresql.
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle-supabase",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: false,
});
