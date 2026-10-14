# PHASE P0A — MySQL Foundation Recovery

**Phase type:** Strictly scoped remediation of the database foundation only.
**Date:** 2026-10-13
**Branch / HEAD (baseline):** `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939`
**Baseline reference:** `docs/FULL-PROJECT-AUDIT.md` (P0 findings C1–C4, H1, H2, M1, M2, M3)
**Engine decision (locked):** MySQL-compatible **MariaDB** via Drizzle ORM + `mysql2`.

**Final verdict: PASS WITH LIMITATIONS** (see §11). The database foundation is
fully recovered and verified; the only non-code blocker is the external Google
Sheets credential dependency at `next build`.

---

## 1. Baseline Repository State

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` ("fix: restore job actions and update database foundation") |
| Working tree at start | Clean except untracked `docs/FULL-PROJECT-AUDIT.md` |
| HEAD vs audited commit | Identical (`7c4cc41`) — no divergence to reconcile |
| Database server | MariaDB **11.8.8** at `127.0.0.1:3306`, database `database-airprod` |
| `DATABASE_URL` scheme | `mysql://` (quoted) |
| Existing DB tables (production) | 14 = 13 app tables + `__drizzle_migrations` |

Prior-phase documents read: `docs/FULL-PROJECT-AUDIT.md`,
`docs/PHASE-MYSQL-REDESIGN.md`, `docs/PHASE-1-MYSQL-FOUNDATION.md`.
Source code was treated as authoritative over historical claims.

Baseline verification (before any change):

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **FAIL** — 89 errors across 17 files |
| `npm run lint` | PASS — 0 errors, 13 warnings |
| `npm run build` | **FAIL** — `Failed to type check` |
| `npm run db:check` | **FAIL** — `DATABASE_URL tidak valid: harus diawali dengan skema postgresql://…` |
| `npm test` | **FAIL** — 0 tests executed (`"\./postgres" is not exported`) |

---

## 2. Root-Cause Analysis

The database foundation had been **partially converted from MySQL to PostgreSQL**
and the conversion was abandoned mid-way, leaving three mutually inconsistent
layers. The committed MySQL artefacts were never updated to match.

1. **Schema files (`src/db/schema/*.ts`) were bulk-rewritten to `pg-core` but left
   incomplete.** Nearly every file was missing its import statements
   (`mysqlTable`/`pgTable`, `varchar`, `date`, `text`, `check`, `integer`,
   `uniqueIndex`, `index`, `primaryKey`, relation helpers, `timestamps`), imported
   `sql`/`datetime` from the wrong package (`pg-core` exports neither), used
   MySQL-only `datetime` in a `pg-core` table, referenced undeclared helper
   functions (`relations`, `one`, `many`, `timestamps`), and used a `check()`
   column-builder form that does not exist. This produced **89 TypeScript errors**
   in 17 files and broke `next build`.
   - Additionally, `job-sequences`/`cashflows`/`job-crews`/`admins` had been
     redesigned with columns that **do not exist** in the committed migration
     (e.g. `job_sequences.{id,month,current_seq}`, `cashflows.{type,direction
     CLIENT/VENDOR,reference_type…}`, `admins.auth_user_id`, `job_crews.
     payment_status`) — i.e. the schema no longer matched the migration snapshot.

2. **Connection layer (`src/db/index.ts`, `src/db/env.ts`) was switched to
   PostgreSQL.** `index.ts` imported the non-existent module `drizzle-orm/postgres`
   and used `pg.Pool` (with MySQL-only `connectionLimit`/`multipleStatements`);
   `env.ts` rejected any URL not starting with `postgres://`.

3. **Tests (`tests/setup.ts`, `tests/helpers/db.ts`) were switched to `pg`** while
   their SQL remained MySQL-specific. `setup.ts` imported
   `drizzle-orm/postgres/migrator`; `helpers/db.ts` used `pg.Pool` for
   `CREATE DATABASE … CHARACTER SET utf8mb4` and `information_schema … ?`
   placeholders.

4. **Configuration/artefacts were still MySQL** (`drizzle.config.ts` dialect
   `mysql`; `drizzle/0000_*.sql` MySQL DDL; `_journal.json` dialect `mysql`; `.env`
   `mysql://`). Net effect: env/config/migration said MySQL, code said PostgreSQL →
   `db:check` aborted, `getDb()` would throw, and tests could not load.

5. **Two latent defects were discovered during recovery** (not visible from static
   analysis):
   - `mysql2`'s `PromisePool` forwards the raw `connection` event from its core
     pool, so the listener receives a **callback-style** connection. Calling
     `.catch()` on its `query()` result throws and **breaks connection
     acquisition** (all queries hang). Restored handler uses the callback form.
   - The connection test issued `SHOW timezone AS tz`, which is **invalid MariaDB
     syntax** (MariaDB/MySQL do not accept an alias on `SHOW`). Replaced with
     `SELECT @@session.time_zone AS tz` (same assertion, valid SQL).

**Conclusion:** the defect was a broken MySQL→PostgreSQL conversion, not a design
flaw in the original MySQL foundation. The correct recovery is to restore the
MySQL schema/tooling to match the already-committed migration — which is what P0A
does.

---

## 3. Files Modified

All changes are confined to the database foundation and its tests. No application
page, UI component, service, repository, Server Action, or business rule was
touched.

| File | Change |
|---|---|
| `src/db/schema/_shared.ts` | `timestamps()` restored to `mysql-core` `datetime(3)` |
| `src/db/schema/admins.ts` | Rewritten to match migration (removed `auth_user_id`) |
| `src/db/schema/sessions.ts` | Rewritten to `mysql-core` (`char(64)`, indexes, FK) |
| `src/db/schema/crew-roles.ts` | Rewritten to `mysql-core` (`int`, `boolean`, unique index) |
| `src/db/schema/crew.ts` | Rewritten to `mysql-core` (FK `crew_roles`, decimal default 0) |
| `src/db/schema/clients.ts` | Rewritten to `mysql-core` |
| `src/db/schema/vendors.ts` | Rewritten to `mysql-core` |
| `src/db/schema/jobs.ts` | Rewritten to `mysql-core` (unique index + 3 CHECKs + 2 FKs) |
| `src/db/schema/job-crews.ts` | Aligned to migration (`crew_role_id`, `agreed_amount`, check) |
| `src/db/schema/cashflows.ts` | Aligned to migration (`occurred_on`, `direction`, `category`, `description`, `source`, 3 indexes, 6 CHECKs) |
| `src/db/schema/client-payments.ts` | Rewritten to `mysql-core` (2 CHECKs, FK cascade) |
| `src/db/schema/vendor-payments.ts` | Rewritten to `mysql-core` (2 CHECKs, FK cascade) |
| `src/db/schema/deliveries.ts` | Rewritten to `mysql-core` (2 CHECKs, FK cascade) |
| `src/db/schema/job-sequences.ts` | Aligned to migration (`year` PK smallint, `next_seq` int) |
| `src/db/index.ts` | Restored `mysql2` pool + `drizzle-orm/mysql2`; lazy connect; UTC; callback-safe `connection` handler |
| `src/db/env.ts` | Accepts `mysql://` / `mariadb://` (rejects non-MySQL schemes) |
| `tests/helpers/db.ts` | Restored `mysql2/promise`; retargets `airprod_test`; production guard kept |
| `tests/setup.ts` | Restored `drizzle-orm/mysql2/migrator`; isolated test DB create/reset/migrate |
| `tests/db-foundation.test.ts` | One invalid-SQL query repaired (`SELECT @@session.time_zone`) |

**Untouched / preserved:** `src/repositories/index.ts` (`getRepositories()` still
returns `googleRepositories`), all Google repository code, all UI/actions/services,
`drizzle/0000_*.sql`, `drizzle/meta/*`, `drizzle.config.ts` (already correct),
`package.json`. `zod` and `@supabase/ssr` remain declared (out of P0A scope).

`git status --short` confirms only `src/db/**`, `tests/**`, and the untracked audit
report differ. No files were committed.

---

## 4. MySQL Schema Recovery

All 13 tables were restored as `drizzle-orm/mysql-core` definitions that
reproduce the committed migration/snapshot **exactly**:

`admins, sessions, crew_roles, crew, clients, vendors, jobs, job_crews,
cashflows, client_payments, vendor_payments, deliveries, job_sequences`.

Key properties restored:

- **PK/columns** per snapshot; `job_sequences` keeps its intentional deviation
  (composite PK on `year` smallint, `next_seq` int — no `id`/`month`/`current_seq`).
- **`timestamps()`** = `datetime(3)` `NOT NULL DEFAULT (CURRENT_TIMESTAMP(3))`
  for `created_at`/`updated_at` (manual `ON UPDATE CURRENT_TIMESTAMP(3)` remains
  in the committed SQL migration, as documented).
- **UNIQUE**: `uq_admins_email`, `uq_sessions_token_hash`, `uq_crew_roles_name`,
  `uq_jobs_job_number`.
- **FKs (11)** with explicit delete behaviour: sessions→admins `cascade`;
  crew→crew_roles, jobs→clients, jobs→vendors, cashflows→jobs `restrict`;
  job_crews→jobs `cascade`, job_crews→crew `restrict`, job_crews→crew_roles
  `set null`; deliveries→jobs, client_payments→jobs, vendor_payments→jobs
  `cascade`.
- **CHECKs (17)** including the XOR client/vendor invariant, job/delivery status
  allow-lists, cashflow amount>0, direction/category invariant, paired
  reference, and source allow-list. Multi-line CHECK expressions are byte-for-byte
  identical to the snapshot (verified by zero-diff generation, §6).
- **Indexes**: cashflows (3), sessions (1), plus the four UNIQUE indexes.
- Decimal money columns are `decimal(15,2)` (never float).

Correct MySQL relations were expressed through `.references()`; the abandoned
`drizzle-orm` relation helpers (`relations`/`one`/`many`) were removed — they are
not part of the Phase-1 schema and are not required for the foundation.

---

## 5. Database Connection Recovery

`src/db/index.ts`:

- Uses `import { drizzle } from "drizzle-orm/mysql2"` + `mysql2/promise`
  (`MySql2Database<typeof schema>`), the correct MySQL adapter.
- **Lazy** connection: the pool is created on first `getDb()` call, cached on
  `globalThis` (hot-reload safe), never on module import.
- **Server-only guard** retained (`getDb()` throws in a browser context).
- `connectionLimit: 10`, `dateStrings: true`, `timezone: "Z"`, pool idle settings.
- Timezone: per-connection `SET time_zone = '+00:00'` via the `connection` event
  so `CURRENT_TIMESTAMP(3)` defaults are stored in UTC. The handler uses the
  **callback** query form because `mysql2`'s promise wrapper forwards the raw
  connection object (see §2).
- `closeDb()` retained for tests/graceful shutdown.
- No credentials are read from source; only `DATABASE_URL` (never logged).

`src/db/env.ts`:

- `getDatabaseUrl()` now accepts `mysql://` and `mariadb://`, rejects anything
  else with a clear message, unwraps surrounding quotes, and fails loud when
  unset. No PostgreSQL environment variable is required.

`drizzle.config.ts`: already `dialect: "mysql"` with `schema`
`./src/db/schema/index.ts` and `out ./drizzle`; no change required.

---

## 6. Migration Reconciliation

The committed MySQL migration (`drizzle/0000_magical_true_believers.sql`,
`meta/0000_snapshot.json`, `meta/_journal.json`) was preserved **unmodified** — no
history was deleted and the baseline was not regenerated.

Reconciliation was verified without writing anything:

```
$ npx drizzle-kit generate
Reading schema files: …/src/db/schema/index.ts
13 tables
admins 9 columns 1 indexes 0 fks
cashflows 12 columns 3 indexes 1 fks
client_payments 9 columns 0 indexes 1 fks
clients 11 columns 0 indexes 0 fks
crew 8 columns 0 indexes 1 fks
crew_roles 6 columns 1 indexes 0 fks
deliveries 11 columns 0 indexes 1 fks
job_crews 8 columns 0 indexes 3 fks
job_sequences 2 columns 0 indexes 0 fks
jobs 13 columns 1 indexes 2 fks
sessions 7 columns 2 indexes 1 fks
vendor_payments 9 columns 0 indexes 1 fks
vendors 8 columns 0 indexes 0 fks

No schema changes, nothing to migrate 😴
```

The migration directory hash was identical before and after (`d904a821…`) — no new
migration was created, and `drizzle-kit check` reports `Everything's fine`.

**No schema change was found necessary**, so no additive migration was written and
no destructive command was run.

Applying the existing migration to a fresh isolated test database produced exactly
the expected structure (read-only `information_schema` introspection):

```
app table count: 13
admins, cashflows, clients, client_payments, crew, crew_roles, deliveries,
jobs, job_crews, job_sequences, sessions, vendors, vendor_payments
FK count: 11 | CHECK count: 17 | UNIQUE count: 4
```

---

## 7. Test Isolation and Execution

`tests/helpers/db.ts` (restored on `mysql2/promise`):

- `resolveTestDatabaseUrl()` **stops the run** unless `DATABASE_URL` points at
  `database-airprod`, then derives `airprod_test`.
- `ensureTestDatabase()` connects to `information_schema` (no app schema) and
  `CREATE DATABASE IF NOT EXISTS airprod_test CHARACTER SET utf8mb4`.
- `dropAllTestTables()` refuses any URL whose path is not `/airprod_test`, and
  resets tables inside a `SET FOREIGN_KEY_CHECKS=0/1` guard.

`tests/setup.ts`:

1. Loads `.env`; runs the production guard.
2. Creates `airprod_test`.
3. Repoints `process.env.DATABASE_URL` to the test DB so `getDb()` uses it.
4. Drops all previous test tables (test DB only).
5. Applies the committed migration via `drizzle-orm/mysql2/migrator`.

**Isolation guarantee:** the production database `database-airprod` is never
connected to by tests beyond the read-only guard check. Verified after the run:
`database-airprod` still has **14 tables** (unchanged); all mutation happened in
`airprod_test`.

`tests/db-foundation.test.ts` verifies (unchanged scope): connectivity;
app→Drizzle→MariaDB; correct test DB target; UTC per connection; insert across
master→job→assignment→cashflow; FK rejection; CHECK XOR (both directions);
category allow-list; cashflow amount>0; direction/category invariant; paired
reference; source allow-list; delivery quantity; UNIQUE `job_number`;
FK RESTRICT (client/job/crew); CASCADE delete; transaction ROLLBACK and COMMIT;
automatic `updated_at`; `job_sequences` per-year uniqueness; decimal handling.

**Result: 22/22 PASS.**

---

## 8. Verification Command Results

| Command | Before | After | Exit (after) |
|---|---|---|---|
| `npx tsc --noEmit` | 89 errors / 17 files | **0 errors** | 0 |
| `npm run lint` | 0 errors, 13 warnings | **0 errors, 1 warning** | 0 |
| `npm run build` | FAIL (`Failed to type check`) | TypeScript **passes**; fails only at prerender (`GOOGLE_SHEETS_ID` missing) | 1 |
| `npm run db:check` | FAIL (scheme error) | **Everything's fine** | 0 |
| `npm test` | 0 tests executed | **22 passed / 22** | 0 |
| `drizzle-kit generate` | — | **No schema changes** (snapshot match) | 0 |

**Build — code vs environmental failure.** The build log shows
`✓ Compiled successfully` and `Finished TypeScript`, then fails at
`Generating static pages` with:

```
Error: Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi pada environment.
    at … src/lib/google-sheets/client.ts:26
    at … src/services/master-service.ts:37
    at … src/app/layout.tsx:30
```

This is the **pre-existing external Google Sheets dependency** (audit C4), not a
database/code failure. Per the phase rules it was not concealed, no fake
credentials were created, no fallback was added, and no application page was
changed. The remaining warning is a pre-existing unused import
(`Job` in `src/app/actions/job-actions.ts`) in out-of-scope application code.

---

## 9. Remaining Audit Findings (out of P0A scope)

| Audit ID | Finding | Status after P0A |
|---|---|---|
| C1 | DB schema non-compiling → build fails | **RESOLVED** |
| C2 | Invalid `drizzle-orm/postgres` import | **RESOLVED** |
| C3 | MySQL↔PostgreSQL config contradiction | **RESOLVED** (engine locked to MySQL/MariaDB) |
| C4 | Runtime 500 — missing Google credentials | **UNCHANGED (expected limitation)** |
| H1 | `next build` fails | **PARTIALLY RESOLVED** — code/TS stage passes; prerender still blocked by external creds |
| H2 | Tests cannot execute | **RESOLVED** — 22/22 pass |
| H3 | No authentication/authorization | Unchanged (future phase) |
| H4 | DB layer not wired to app (`getRepositories()` still Google) | Unchanged (future phase) |
| M1 | Pool misconfiguration | **RESOLVED** (mysql2 pool; `connectionLimit` valid) |
| M2 | Tests used MySQL SQL against Postgres | **RESOLVED** (MySQL everywhere) |
| M3 | Domain/schema drift | **PARTIALLY** — DB schema now matches migration; app domain reconciliation is later-phase work |
| M4–M8, L1–L5 | Venue removal, crew roles, job numbering, cashflow, headers, dead code | Unchanged (future phases) |

---

## 10. Risks and Limitations

1. **Build is not green end-to-end** — blocked by the missing `GOOGLE_SHEETS_ID`
   external dependency during static prerender. This is the same limitation
   recorded in `docs/PHASE-1-MYSQL-FOUNDATION.md`. It is environmental, not code.
   Options for a later phase (require separate approval): make data-reading pages
   dynamic, or provide credentials.
2. **Runtime still returns HTTP 500** for the same reason; P0A did not change the
   active data source (`googleRepositories`).
3. **`ON UPDATE CURRENT_TIMESTAMP(3)` is not represented in the Drizzle schema** —
   if the migration is ever regenerated, that clause must be re-applied manually
   (documented in `_shared.ts`).
4. **`job_sequences` PK deviation** (`year` smallint) is intentional and retained.
5. **`pg` / `@types/pg` remain installed** (unused). Removing them is a dependency
   change outside P0A scope; no PostgreSQL import remains in the foundation.
6. **The `PromisePool` connection-event subtlety** is now documented in code; any
   future change to per-connection setup must keep the callback form.
7. **No production data was read or written** beyond the read-only guard check;
   production table count remained 14.

---

## 11. Final Verdict

### **PASS WITH LIMITATIONS**

All P0A code acceptance criteria are met:

- ✅ Database engine is consistently MySQL/MariaDB (no active PostgreSQL imports).
- ✅ All schema TypeScript errors resolved (`tsc` 0 errors).
- ✅ Schema reconciles with the committed migration (zero-diff generate;
  `db:check` clean; 13 tables / 11 FKs / 17 CHECKs / 4 UNIQUE applied fresh).
- ✅ Connection configuration correct (mysql2, lazy, UTC, no creds in source).
- ✅ DB tests execute safely against an isolated `airprod_test` (22/22).
- ✅ TypeScript passes; lint has **zero errors**.
- ✅ `getRepositories()` unchanged (still `googleRepositories`).
- ✅ No application business features changed.
- ✅ No production data modified.

**Limitation:** `npm run build` cannot exit 0 because static prerender requires
`GOOGLE_SHEETS_ID`, which is not available in this environment (pre-existing,
acknowledged, out of P0A scope). The build's compile and TypeScript stages pass.

The whole application is **not** claimed ready for production.

---

## 12. Next Recommended Phase

**PHASE P0B — MySQL Repository Implementation (Step 5 of the approved roadmap).**
Implement the `DataRepositories` contract over the now-healthy Drizzle/MySQL
foundation (`src/repositories/mysql/**`) without yet flipping
`getRepositories()`; then prepare the `getRepositories()` switch + data migration
(Steps M1–M6 from `docs/PHASE-MYSQL-REDESIGN.md`).

Prerequisites for a fully green build/runtime remain external: real Google Sheets
credentials or an approved alternative, and (later) authentication (audit H3).

---

### Appendix — Raw Evidence Snippets

```
$ npm run db:check
Everything's fine 🐶🔥

$ npx drizzle-kit generate
13 tables … No schema changes, nothing to migrate 😴

$ npm test
Test Files  1 passed (1)
     Tests  22 passed (22)

$ npx tsc --noEmit
(no output; exit 0)

$ npm run lint
✖ 1 problem (0 errors, 1 warning)

$ npm run build
✓ Compiled successfully in 3.5s
  Finished TypeScript in 19.3s
Error: Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi pada environment.
Export encountered an error on /clients/page: /clients, exiting the build.
```
