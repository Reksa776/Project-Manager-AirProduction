import mysql from "mysql2/promise";
import pg from "pg";

try {
  process.loadEnvFile();
} catch {
  // The two URLs may be supplied by the execution environment.
}

const sourceUrl = process.env.MYSQL_SOURCE_URL?.trim();
const targetUrl = process.env.DATABASE_URL?.trim();
if (!sourceUrl || !/^(mysql|mariadb):\/\//i.test(sourceUrl)) {
  throw new Error("Set MYSQL_SOURCE_URL to the existing MySQL database.");
}
if (!targetUrl || !/^postgres(?:ql)?:\/\//i.test(targetUrl)) {
  throw new Error("Set DATABASE_URL to the Supabase PostgreSQL connection string.");
}

// Explicit allowlist: legacy-only tables (venues/expenses) are not imported.
const tables = [
  "admins",
  "clients",
  "vendors",
  "packages",
  "crew_roles",
  "crew",
  "jobs",
  "job_sequences",
  "sessions",
  "deliveries",
  "client_payments",
  "vendor_payments",
  "job_crews",
  "cashflows",
];
const booleanColumns = new Set(["is_active"]);
const seedRoleNames = new Set(["Editor", "Videographer"]);

const source = await mysql.createConnection({
  uri: sourceUrl.replace(/^mariadb:/i, "mysql:"),
  dateStrings: true,
  timezone: "Z",
});
const target = new pg.Pool({ connectionString: targetUrl, max: 1 });
let targetClient;

try {
  targetClient = await target.connect();
  await targetClient.query("BEGIN");

  // The seed command may have inserted its two default roles before the transfer.
  // Reconcile those by unique role name; other existing target data is not allowed.
  for (const table of tables) {
    if (table === "crew_roles") {
      const existingRoles = await targetClient.query("SELECT name FROM public.crew_roles");
      const unexpectedRole = existingRoles.rows.find((row) => !seedRoleNames.has(row.name));
      if (unexpectedRole) {
        throw new Error("Target table 'crew_roles' has custom rows; refusing to merge over them.");
      }
      continue;
    }
    const result = await targetClient.query(`SELECT count(*)::int AS count FROM public."${table}"`);
    if (result.rows[0].count !== 0) {
      throw new Error(`Target table '${table}' is not empty; refusing to copy data.`);
    }
  }

  const copied = [];
  const crewRoleIds = new Map();
  for (const table of tables) {
    const [sourceTables] = await source.query("SHOW TABLES LIKE ?", [table]);
    if (sourceTables.length === 0) continue;

    const [sourceRows] = await source.query(`SELECT * FROM \`${table}\``);
    if (sourceRows.length === 0) {
      copied.push(`${table}: 0`);
      continue;
    }

    const targetColumnsResult = await targetClient.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [table],
    );
    const targetColumns = new Set(targetColumnsResult.rows.map((row) => row.column_name));
    const columns = Object.keys(sourceRows[0]).filter((column) => targetColumns.has(column));
    if (columns.length === 0) throw new Error(`No shared columns found for '${table}'.`);

    const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const insertSql = `INSERT INTO public."${table}" (${quotedColumns}) VALUES (${placeholders})`;
    for (const row of sourceRows) {
      const values = columns.map((column) => {
        const value = row[column];
        if (booleanColumns.has(column) && value !== null) return Boolean(value);
        if (table === "crew" && column === "crew_role_id") {
          return crewRoleIds.get(value) ?? value;
        }
        return value;
      });
      if (table === "crew_roles") {
        const existing = await targetClient.query(
          "SELECT id FROM public.crew_roles WHERE name = $1",
          [row.name],
        );
        if (existing.rows[0]) {
          await targetClient.query(
            "UPDATE public.crew_roles SET sort_order = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
            [row.sort_order, Boolean(row.is_active), existing.rows[0].id],
          );
          crewRoleIds.set(row.id, existing.rows[0].id);
        } else {
          await targetClient.query(insertSql, values);
          crewRoleIds.set(row.id, row.id);
        }
      } else {
        await targetClient.query(insertSql, values);
      }
    }
    copied.push(`${table}: ${sourceRows.length}`);
  }

  await targetClient.query("COMMIT");
  console.log("MySQL data copied to Supabase. Row counts:");
  for (const line of copied) console.log(`- ${line}`);
} catch (error) {
  if (targetClient) await targetClient.query("ROLLBACK");
  throw error;
} finally {
  targetClient?.release();
  await target.end();
  await source.end();
}
