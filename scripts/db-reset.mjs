import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pg from "pg";

try {
  process.loadEnvFile();
} catch {
  // DATABASE_URL may be supplied by the shell or deployment environment.
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("Set DATABASE_URL to the PostgreSQL connection string before resetting the database.");
}
if (!stdin.isTTY || !stdout.isTTY) {
  throw new Error("Database reset requires an interactive terminal so you can confirm the destructive action.");
}

const target = new URL(databaseUrl);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, "")) || "unknown";
const confirmation = createInterface({ input: stdin, output: stdout });

try {
  console.log(`WARNING: this will permanently delete all Air Production data from database '${databaseName}'.`);
  console.log("Tables, schema, and migration history will be kept. Admin accounts and login sessions will also be deleted.");
  const answer = await confirmation.question("Type RESET AIR PRODUCTION to continue: ");
  if (answer !== "RESET AIR PRODUCTION") {
    console.log("Reset cancelled. No data was changed.");
    process.exitCode = 1;
  } else {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await pool.query("BEGIN");
      await pool.query(`
        TRUNCATE TABLE
          public.sessions,
          public.cashflows,
          public.client_payments,
          public.vendor_payments,
          public.job_crews,
          public.deliveries,
          public.jobs,
          public.job_sequences,
          public.clients,
          public.vendors,
          public.crew,
          public.crew_roles,
          public.packages,
          public.admins
        RESTART IDENTITY CASCADE
      `);
      await pool.query("COMMIT");
      console.log("Database reset complete. All application data was deleted; schema and migration history were kept.");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    } finally {
      await pool.end();
    }
  }
} finally {
  confirmation.close();
}
