# FRESH START MYSQL — TARGET ARCHITECTURE & P0E ROADMAP

**Status:** planning document (P0D-CLOSE). **Nothing in this document is
implemented or approved for execution.** It records the owner decision, the
audited starting point, the target architecture, and the proposed next phase
**P0E-1 — MySQL Runtime Activation Preparation**, which is **NOT STARTED** and
requires its own explicit approval.

**Owner decision (authoritative): OPTION A — FRESH START MYSQL.**
Historical Google Sheets data is not required and must not be migrated.
MySQL/MariaDB is the intended sole active runtime database. Google Sheets is
legacy and is retired in a later, separately approved phase.

**This decision does NOT authorise** deleting historical data, deleting any
spreadsheet, dropping/truncating/resetting any database, applying production
migrations, switching the runtime, or deploying. Any destructive or
production-affecting action needs a **new, explicit owner approval** stating its
exact scope.

---

## 1. What "Fresh Start" means (and does not mean)

| Means | Does not mean |
| --- | --- |
| No historical import is required or performed | Deleting the Google Sheets spreadsheet or its data |
| Historical migration gates (D1–D12, snapshot, S4 fields, 0001-for-migration) are no longer prerequisites of the selected path | Applying `0001` to production without approval |
| The canonical MySQL layer becomes the target runtime | Switching the runtime in this phase |
| Migration tooling/documents are **archived**, not deleted | Rewriting or erasing historical phase evidence |
| New data starts empty in MySQL | Seeding, resetting, or truncating anything |

Verified context: `database-airprod` currently holds **14 tables, all 0 rows**
(read-only preflight). An empty database is **not** permission to reset it.

## 2. Business requirements that remain in force (independent of migration)

These must be tracked as **new-data** requirements, not as historical-import
gates. They are deliberately **not** carried over as D1–D12 decisions, and their
old decisions must never be silently applied to new MySQL data.

| # | Requirement | Where it must land |
| --- | --- | --- |
| B1 | **Crew Roles** as a real entity (`crew_roles`, FK from `crew.crew_role_id`) | P0E-1 wiring + P2B UI (role CRUD, no free-text role) |
| B2 | **Financial ledger integrity** — obligation vs cash, decimal-string money, atomic writes, DB-level idempotency | P0C-2 (done) + P0E-1 activation |
| B3 | **Job Number generation** | P2A (`job_sequences`); today the legacy form requires manual entry |
| B4 | **Authentication & authorization** | P1A / P1B; canonical `admins`/`sessions` are read-only today |
| B5 | **Venue removal from the active UI** | P0E-1 (routing/UX) + P2D/P3A; the canonical model has no venue entity |
| B6 | **Client form structure** (`company_name`, `contact_person`, `email`, `client_type`) | P2B/P2D UI work against the canonical `clients` table |
| B7 | **Vercel-compatible database connectivity** | P0E-1 connectivity decisions (§6) + P4A |

## 3. Audited starting point (P0D-CLOSE, read-only)

| Area | Verified state |
| --- | --- |
| Active runtime repository | `getRepositories()` → `googleRepositories` (`src/repositories/index.ts`) |
| Canonical MySQL layer | Implemented but **not referenced by application code**: `createCanonicalMySqlRepositories` (12/12 contract members), `createMySqlApplication()`, canonical services `master/jobs/deliveries/adminSessions/financial` |
| Only app-side MySQL touchpoint | `src/services/finance-service.ts` (canonical financial service; imports `@/repositories/contract` + `@/repositories/mysql/finance`) — not wired into any page/action |
| Google Sheets runtime dependencies | `src/lib/google-sheets/client.ts`, `src/repositories/google/**`, the 4 legacy services, `job-detail-actions.ts`, **and `src/app/layout.tsx`** (so *every* route needs credentials) |
| Production schema | 14 tables, all 0 rows; journal = `0000` only; `cashflows.job_id` NOT NULL; no idempotency columns/UNIQUE; no drift |
| Legacy-contract MySQL adapter | `mysqlRepositories: DataRepositories` exists but **19 method bodies are explicitly blocked** (venues, expenses, client/vendor payment writes) |
| Build | compile ✓, TypeScript ✓, static prerender ✗ — inherited Google Sheets credential dependency |

## 4. Target architecture (Fresh Start)

```
Browser ─▶ Next.js App Router (server components + Server Actions)
                │
                ├─ canonical services  (src/services/canonical/**)
                │     master · jobs · deliveries · adminSessions
                ├─ canonical financial service (src/services/finance-service.ts)
                │     obligations vs cash · idempotency · decimal Amount
                │
                └─ Contract v2 repositories (src/repositories/contract)
                        │
                        └─ MySQL/MariaDB via Drizzle + mysql2  (src/db/**)
                              database-airprod  (sole runtime DB)
```

Guiding rules for the transition:

1. **One runtime provider.** `getRepositories()` must end up returning a
   MySQL-backed implementation, and the Google implementations must leave the
   runtime path — not merely be swapped behind a flag.
2. **No fake adapters.** Do not stub a legacy method to satisfy the old contract
   (e.g. a fake `venues` repository). Where the canonical model has no
   equivalent, the **UI/feature changes**, and that change is planned, not faked.
3. **Contract v2 is the source of truth** for repositories and services; the
   legacy contract (`src/repositories/types.ts`) is retired with the UI changes.
4. **Legacy services are replaced, not forked.** `master-service`, `job-service`,
   `dashboard-service` and the legacy finance CRUD path in `job-service` are
   either rebuilt on canonical services or deleted with their UI.
5. **Historical tooling stays archived** (`src/migration/**`,
   `src/migration-cli/**`, migration docs) and must never be invoked as part of
   the runtime.

## 5. Baseline → target gap analysis

| # | Gap | Evidence | Consequence if skipped |
| --- | --- | --- | --- |
| G1 | **`0001` not applied** to `database-airprod` | preflight: journal `0000` only, no idempotency columns, `job_id` NOT NULL | Canonical cashflow/expense writes fail (they insert `idempotency_key`/`idempotency_fingerprint`) and jobless expenses cannot be stored → **hard precondition** |
| G2 | Runtime still Google Sheets | `getRepositories()` | App cannot start without Sheets credentials; build prerender fails |
| G3 | Canonical layer unused by the app | grep: no page/action imports `services/canonical` | Implementing P0E without rewiring changes nothing |
| G4 | Legacy UI entities without a canonical table (**venues**) | `VENUE_REASON` blocked in `src/repositories/mysql/index.ts`; no `venues` table in `src/db/schema` | The `/venues` route and job venue pickers break |
| G5 | Legacy **expenses** entity vs canonical `cashflows` | `EXPENSE_REASON` blocked; `expenses` table absent | Finance page expense CRUD breaks |
| G6 | Stored payment **status** vs derived status | `client_payments`/`vendor_payments` in canonical model have no stored `status` | Payment badges/CRUD break silently if statuses are faked |
| G7 | Crew **role** free text vs `crew_roles` FK | legacy `Crew.role: string` vs canonical `crewRoleId` | Crew forms break; roles must be chosen/created |
| G8 | **Job number** manual entry | `job-service.assertUniqueJobNumber` scans all jobs | Canonical `jobs.create` requires an explicit `jobNumber`; UX needs P2A generation |
| G9 | `admins` read-only in canonical | `AdminRepository` is read-only; auth is P1A | Login/authorization is not part of P0E-1 and must stay out of scope |
| G10 | Build-time credential dependency | `src/app/layout.tsx` → `getCurrentAdmin()` | Any build (including Vercel preview) fails without Sheets credentials |
| G11 | Vercel/serverless connection model | `mysql2` pool, `connectionLimit: 10`, `globalThis`-cached, lazy | Connection exhaustion per serverless instance under load |
| G12 | Provider undecided | no managed MySQL/MariaDB exists in the available service catalog | Deployment target for the database is an open owner decision |

## 6. Vercel connectivity considerations

Facts established in this phase:

- The app already reads the database through a **connection-string pool**
  (`DATABASE_URL`, `mysql2`, Drizzle, `dateStrings`, UTC `time_zone`), cached on
  `globalThis` and created **lazily** — serverless-friendly in shape, but the
  pool size (10) is per function instance, not global.
- Vercel runs backends as **serverless functions**; Vercel publishes an official
  connection-pooling guide recommending care with pools in functions
  (<https://vercel.com/kb/guide/connection-pooling-with-functions>).
- A **serverless-friendly driver or an external pooler** (or conservative pool
  limits plus Vercel's Fluid compute) is the normal mitigation for MySQL over
  serverless.
- **No managed MySQL/MariaDB service is available in the current service
  catalog** (a catalog search returned only MongoDB Atlas, Tiger Cloud
  (PostgreSQL) and Turbopuffer). Therefore:

| Decision | Options | Status |
| --- | --- | --- |
| D-CONN-1 — database provider | (a) an owner-chosen managed MySQL/MariaDB host reachable from Vercel; (b) a MySQL-compatible serverless provider with a fetch-based driver; (c) re-platform to the catalog's PostgreSQL option (Tiger Cloud) — **rejected as a default** because it would change engine, dialect, migrations and ORM wiring | **OPEN — owner decision required** |
| D-CONN-2 — connection strategy | (a) keep `mysql2` pool with tuned small limits; (b) add a pooler/HTTP driver; (c) both | **OPEN — decide in P0E-1, implement in P4A** |

Credentials are supplied **only** as environment variables (`DATABASE_URL` and
any provider-specific values) and are never printed, committed, or embedded.
Production values are set in the Vercel project settings — **not in this phase**.

## 7. Proposed next phase — **P0E-1 — MySQL Runtime Activation Preparation**

**Status: NOT STARTED. Approval-gated. Not implemented by P0D-CLOSE.**
Goal: make the application capable of running on MySQL without losing required
user-facing functionality, validated **first** against the isolated test database
(`airprod_test`), with production activation left as a separate explicit gate.

### 7.1 Scope (in) and non-goals (out)

In: repository/service wiring behind a single provider seam; removal of the
Google Sheets runtime path from the application; resolution of legacy-contract
and UI incompatibilities by **planned feature changes** (no fake adapters);
elimination of the build-time credential dependency (dynamic rendering where
appropriate); environment-variable contract (names only); `0001` preconditions
and rehearsed rollout; isolated-DB validation; rollback; tests and build
acceptance.

Out (deferred to later phases): production activation/switch (P0E-2 gate),
authentication & authorization (P1A/P1B), job-number generation (P2A), crew-role
master UI (P2B), full finance/cashflow UI (P2D), dashboard/delivery rework (P2E),
UI/UX finalisation (P3A), E2E testing (P3B), Vercel deployment config (P4A),
deployment (P4B).

### 7.2 Work breakdown

| # | Task | Notes / acceptance |
| --- | --- | --- |
| P0E-1.1 | Introduce the MySQL-backed implementation of the runtime provider (`getRepositories()` seam) using canonical Contract v2 repositories | Single seam; no page/action may import a concrete provider; behaviour verified against `airprod_test` |
| P0E-1.2 | Replace the legacy services used by pages/actions with canonical services (`master`, `jobs`, `deliveries`, `adminSessions`, `financial`) | Legacy `master-service`, `job-service`, `dashboard-service` either rebuilt or deleted together with their UI; no dual implementations left |
| P0E-1.3 | Resolve G4 (venues): remove venue from the active UI, keep `jobs.legacy_venue_name` as the free-text historical field where a name is still needed | No `venues` table, no fake venue repository; navigation updated |
| P0E-1.4 | Resolve G5/G6 (expenses, payment status): finance reads/writes move to cashflows + schedules via `financial.record*`; status shown is **derived** | No stored status field is re-created; UI reflects derived values |
| P0E-1.5 | Resolve G7 (crew roles): crew forms use `crew_roles` selection/creation | No free-text role, no implicit role creation |
| P0E-1.6 | Resolve G8 (job number): keep explicit/manual entry for now, validated against the canonical UNIQUE constraint; generation stays P2A | No auto-numbering in P0E-1 |
| P0E-1.7 | Resolve G10 (build): stop reading data during build — make data-dependent routes dynamic (or otherwise build-safe) so `next build` succeeds without any Google Sheets credentials | **Google credentials must no longer be required to build** |
| P0E-1.8 | Environment contract: document required variables (`DATABASE_URL`; optional `MIGRATION_SNAPSHOT_AT` only for archived tooling). Values are never printed | Names only; `.env.example` updated without secrets |
| P0E-1.9 | `0001` preconditions: `db:check` clean; journal = `0000`; row-count baseline; backup + restore rehearsal into a throwaway DB; then apply `0001` **to `airprod_test` first**, re-verify, and keep production application **behind a separate written approval** | Production stays untouched in P0E-1 unless separately approved |
| P0E-1.10 | Isolated-DB validation: run the full application surface against `airprod_test` (tests + manual smoke of every route) | `airprod_test` never used as a production database |
| P0E-1.11 | Rollback plan: revert the provider seam (single commit/flag) and restore the previous dump; `0001` has no down-migration → restore path documented | Rollback rehearsed on the test database |
| P0E-1.12 | Tests: canonical path coverage for every rewired route/action; keep all 214 existing tests green; add regression tests for the removed venue/expense/status behaviours | No test deleted or weakened to pass |
| P0E-1.13 | Build acceptance: `tsc` 0 errors, `lint` 0 errors, `db:check` clean, full test suite green, **`npm run build` exits 0 with no Google Sheets credentials present** | The inherited prerender blocker must be gone |
| P0E-1.14 | Production activation gate (P0E-2, separate approval): written approval naming window, operator, backup location, and go/no-go; production `0001` rollout per `docs/MIGRATION-RUNBOOK.md` Part A | Not part of P0E-1 |

### 7.3 Environment variables (names only)

| Variable | Needed by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | runtime + drizzle-kit + tests | MySQL/MariaDB connection string; already the single source of truth |
| `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | **archived migration tooling only** | Must become **optional**: absent from the required application runtime path after P0E-1 |
| `MIGRATION_SNAPSHOT_AT` (optional) | archived snapshot CLI determinism | Does not affect the application |

### 7.4 Risks

| Risk | Mitigation |
| --- | --- |
| Silent functional regression while removing venue/expense/status UI | Explicit UX decisions up front (P0E-1.3–1.6) + regression tests + test-DB smoke pass |
| `0001` applied to the wrong database | Preflight guard already restricts to `database-airprod`; `airprod_test` is applied first; production rollout separately approved |
| Provider/serverless connection exhaustion | Decide D-CONN-2; conservative pool limits; verify under concurrent load before P4A |
| Scope creep into P1A/P2A/P2D | Fixed non-goals list (§7.1) and per-task acceptance criteria |
| Archived migration tooling accidentally invoked | Tooling stays out of the app import graph (already enforced by tests) and is documented as archived |

### 7.5 Definition of done for P0E-1

- No application page, action, or legacy service imports a Google Sheets module.
- `getRepositories()` resolves to a MySQL/Contract-v2 implementation; the Google
  implementations remain in the repo but off the runtime path.
- `npm run build` **succeeds without** `GOOGLE_SHEETS_ID`/`..._EMAIL`/`..._PRIVATE_KEY`.
- `tsc` 0 errors · `lint` 0 errors · `db:check` clean · full suite green (≥214 tests, none weakened).
- `0001` applied and verified on `airprod_test`; production unchanged pending the
  separate activation approval.
- Rollback rehearsed and documented.

## 8. What is explicitly NOT authorised by this plan

Applying `0001` to `database-airprod` · switching the production runtime ·
seeding/resetting/truncating any database · deleting Google Sheets data or the
sheet itself · deleting archived migration tooling or documents · committing,
pushing, or deploying · requesting or storing Google credentials · starting
P0E-1 without a new explicit owner approval.
