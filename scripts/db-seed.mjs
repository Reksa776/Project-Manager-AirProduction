import { randomUUID } from "node:crypto";
import pg from "pg";

try {
  process.loadEnvFile();
} catch {
  // DATABASE_URL may be supplied by the shell or deployment environment.
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("Set DATABASE_URL to the Supabase PostgreSQL connection string before seeding.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const defaultRoles = [
    { name: "Editor", sortOrder: 10 },
    { name: "Videographer", sortOrder: 20 },
  ];

  for (const role of defaultRoles) {
    await pool.query(
      `INSERT INTO crew_roles (id, name, sort_order, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (name) DO UPDATE SET
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [randomUUID(), role.name, role.sortOrder],
    );
  }

  console.log("Seed complete: Editor and Videographer roles are available.");
} finally {
  await pool.end();
}
