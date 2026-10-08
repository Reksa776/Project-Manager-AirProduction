import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db/env";

/**
 * Konfigurasi Drizzle Kit (Phase 1 — MySQL Foundation).
 *
 * - Kredensial diambil dari DATABASE_URL (env), tidak pernah di-hardcode
 *   dan tidak pernah dicetak ke output.
 * - `schema`  : barrel seluruh tabel MySQL (src/db/schema).
 * - `out`     : folder migration SQL yang di-commit ke git (reviewable).
 * - `dialect` : mysql (kompatibel dengan MariaDB 11.8 di environment ini).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: false,
});
