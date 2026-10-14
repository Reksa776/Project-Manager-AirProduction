# P0E-DEV-1 — Local Application Runtime Stabilization

**Project:** Air Production Project Manager  
**Phase:** P0E-DEV-1 — local-development subphase of **P0E (MySQL Activation)**  
**Verdict:** PASS  
**Branch / HEAD:** `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` (nothing committed/pushed)  
**Master dashboard / report index:** [`docs/PROJECT-PROGRESS.md`](../PROJECT-PROGRESS.md) — its **Section J** holds the concise summary  
**Report policy:** separate detailed phase report (effective from P0E-DEV-1 onward)

> This is the complete, standalone P0E-DEV-1 report. The master dashboard
> (`docs/PROJECT-PROGRESS.md`) keeps only a concise summary plus a link to this file.

---
### J.1. Objective, exact scope, and verdict

**Objective:** make the **existing** Air Production application usable in **local
development** on the owner's Fedora + MariaDB environment, without any production
activation, deployment, or destructive action.

**In scope (executed):** local runtime configuration; a dedicated, separate MariaDB
development database; existing Drizzle migration verification on it; database-connection
debugging; fixing startup/rendering/integration errors found; local smoke testing of
every active route and implemented workflow; regression tests for discovered bugs; a
reliable local startup procedure; and consolidated reporting.

**Out of scope (not performed):** VPS deployment; production MySQL installation; public
exposure; P1A authentication; P1B authorization; new business features; automatic job
numbering; Google Sheets migration; production backup execution; P0E-2B activation;
**commit / push / stash / reset / revert / git clean**.

**Verdict: PASS.** The application starts against MariaDB, connects to the intended
**development** database, serves all active routes with no uncaught runtime errors, and
exercises every implemented workflow end-to-end through the real UI/Server-Action
boundary. All mandatory verification commands pass; the existing 272 tests are intact
and 6 focused regression tests were added (**278/278**). Two genuine defects were
reproduced, root-caused, fixed and regression-tested. `database-airprod` and
`airprod_test` remain untouched.

> **Owner environment decision (authoritative, re-affirmed — do not ask again):**
> **LOCAL DEVELOPMENT** = Fedora Linux + **MariaDB 11.8.8** (development/execution).
> **FUTURE VPS PRODUCTION** = Oracle MySQL 8 (deferred; **not authorized** in this
> phase). The local MariaDB install is **not** replaced and Oracle MySQL is **not**
> installed on Fedora.

### J.2. Verified starting baseline (rechecked, not trusted)

| Item | Reported (previous phase) | Verified at P0E-DEV-1 start |
| --- | --- | --- |
| Branch / HEAD | `main` @ `7c4cc41…` | identical — `7c4cc410979aa0bcc79e0d04143ecc7463341939` |
| Working tree | uncommitted P0A→P0E-2A.1 work | preserved; **91** changed/untracked paths; nothing discarded |
| Tests | 272/272 (11 files) | **272/272**, exit 0 |
| TypeScript | PASS | `npx tsc --noEmit` exit 0 |
| ESLint | PASS, 0 warnings | exit 0, no output |
| Build without Google creds | PASS | `npm run build` exit 0 with `GOOGLE_*` unset |
| Host / DB engine | — | Fedora Linux 44 (KDE); MariaDB **11.8.8** on `127.0.0.1:3306`, service **active** |
| Databases present | — | `database-airprod` (13 app tables, **0 rows**, journal `0000`), `airprod_test` (13 tables), **no `airprod_dev`** |
| `db:check` | clean | `Everything's fine 🐶🔥`, exit 0 |

The one physical difference from the previous report: an **unrelated** application
(`repiw-nextjs-project`) was already listening on **port 3000** on this machine. Because
of that, the local verification used **port 3001** (`PORT=3001 npm run dev`); the default
`npm run dev` still uses 3000 whenever it is free. Nothing in this repository uses port 3000.

### J.3. Actual changed files (this phase only)

| File | Change | Git |
| --- | --- | --- |
| `.env` | `DATABASE_URL` re-pointed from `database-airprod` to **`airprod_dev`**; the original production URL is preserved as a **commented, disabled** line with a warning. Only file that holds credentials; already git-ignored. | ignored (`.env*`) |
| `tests/helpers/db.ts` | Guard fixed: `resolveTestDatabaseUrl()` now accepts **either** the production base **or** the development base (`airprod_dev`), always derives `airprod_test`, and still rejects unknown bases and any production target. New export `DEV_DATABASE`. | modified |
| `tests/setup.ts` | Doc comment updated to describe the two accepted base databases. | modified |
| `next.config.ts` | Added `allowedDevOrigins: ["localhost", "127.0.0.1"]` (local-dev-only fix — see J.6). | modified |
| `tests/local-dev-runtime.test.ts` | **NEW** — 6 regression tests (dev/test guard + dev-origin config). | new |
| `docs/PROJECT-PROGRESS.md` | Section J (this report) + dashboard/roadmap/log/blocker/readiness/handoff updates. | modified (this file only) |

**Database DDL/DML:** `CREATE DATABASE airprod_dev` + migrations `0000`+`0001` applied to
`airprod_dev` **only**; local smoke-test data written to `airprod_dev` **only** (J.10).
**No other project file was changed; no existing test was weakened or removed.**

### J.4. Development database configuration

| Property | Value |
| --- | --- |
| Application database (`.env` `DATABASE_URL`) | **`airprod_dev`** (host `127.0.0.1:3306`, utf8mb4) |
| Automated-test database | **`airprod_test`** (derived by `tests/helpers/db.ts`, reset on each `vitest` run) |
| Protected production-like database | **`database-airprod`** — *not used by local development* |
| Google credentials | **not required** (no `GOOGLE_*` present; build passes without them) |
| Secrets | Only in git-ignored `.env`; never printed in logs or in this report |
| Connection failures | Sanitised: `DATABASE_URL` is validated by scheme, errors never echo credentials (`src/db/env.ts`) |

`airprod_dev` did **not** exist before this phase (verified via `information_schema.SCHEMATA`)
and was created explicitly for development. `database-airprod` and `airprod_test` were
left exactly as they were.

### J.5. Applied development-only migrations

Migrations were applied with the project's existing Drizzle chain, **against `airprod_dev`
only**, using an explicit `DATABASE_URL` override so no command could touch production:

```
DATABASE_URL="mysql://<user>:<pass>@127.0.0.1:3306/airprod_dev" npm run db:migrate   # exit 0
```

| Evidence | `airprod_dev` | `airprod_test` | `database-airprod` |
| --- | --- | --- | --- |
| Domain tables | 13 (+ `__drizzle_migrations`) | 13 (+ journal) | 13 (+ journal) |
| Journal rows | **2** (`0000` + `0001`) | 2 | **1** (`0000` only — unchanged) |
| `cashflows.job_id` nullable | yes | yes | no (still `NOT NULL`) |
| `idempotency_key` / `idempotency_fingerprint` | present | present | absent |
| `uq_cashflows_idempotency_key` UNIQUE | present | present | absent |

`0001` was **not** applied to `database-airprod`; production remains at journal `0000`.

### J.6. Root causes of discovered runtime errors and their repairs

**Defect 1 — test suite refuses to run when the app is on the development database.**
*Reproduce:* after pointing `.env` at `airprod_dev`, `tests/setup.ts` calls
`resolveTestDatabaseUrl()`, which required `DATABASE_URL` to equal `database-airprod` and
threw `STOP: … diharapkan 'database-airprod'`, aborting **all** tests.
*Root cause:* the guard hard-coded the production name as the only valid base, whereas
the phase's own architecture requires the app to point at `airprod_dev` while tests still
use `airprod_test`.
*Fix (smallest correct):* `tests/helpers/db.ts` now accepts a **set** of known base
databases (`database-airprod` **or** `airprod_dev`), always derives `airprod_test`, and
keeps the hard block that the test URL may never be the production database.
*Regression test:* `tests/local-dev-runtime.test.ts` (accept dev base → `airprod_test`;
accept prod base → `airprod_test`; reject unknown base; reject an already-test base).

**Defect 2 — Next 16 blocks dev resources for the `127.0.0.1` origin (font 403 + HMR
failure + incomplete hydration in the preview browser).**
*Reproduce:* opening `http://127.0.0.1:3001/*` returned `403` for
`/__nextjs_font/geist-latin.woff2`, spammed `WebSocket … /_next/hmr … ERR_INVALID_HTTP_RESPONSE`,
and in the automated browser the client components never became interactive (no React
props on DOM nodes; clicking “Tambah” did nothing).
*Root cause:* the dev server's own origin is `localhost`; requests to the same port via
`127.0.0.1` were treated as **cross-origin** and blocked by Next.js 16's default dev-resource
protection (the server log states it verbatim and suggests `allowedDevOrigins`).
*Fix (smallest correct):* `next.config.ts` adds `allowedDevOrigins: ["localhost", "127.0.0.1"]`.
*Verification:* after restart, `/__nextjs_font/geist-latin.woff2` returns **200** via both
`localhost` and `127.0.0.1`, `[HMR] connected` appears with no errors, and the client
components hydrate and open their modals on both origins.
*Regression test:* `tests/local-dev-runtime.test.ts` asserts `next.config.ts` declares
`allowedDevOrigins` with both loopback hosts.

No other runtime errors were found: the server log contained no stack traces, and the
browser console showed no React/hydration/Server-Action errors once the origin fix was in
place.

### J.7. Regression tests added

`tests/local-dev-runtime.test.ts` — **6 tests** (no database access):
1. `.env` points the application at a known base database (dev/production), never the test DB.
2. Guard accepts the development base and derives `airprod_test`.
3. Guard accepts the production base yet never targets production.
4. Guard rejects an unknown base (`STOP`).
5. Guard rejects a `DATABASE_URL` that already points at the test database.
6. `next.config.ts` allows the loopback dev origins.

### J.8. Verification commands, results, and exit codes

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0** |
| `npm run lint` | 0 errors, 0 warnings | **0** |
| `npm run db:check` | schema ⟷ journal consistent | **0** |
| `npx vitest run` | **278 passed / 278** (12 files) | **0** |
| `npm run build` (with `GOOGLE_*` unset) | compiled + TS + prerender OK; `/` & `/_not-found` static, 6 data routes dynamic | **0** |
| `PORT=3001 npm run dev` | Ready in ~1.1 s; `[HMR] connected` | running |
| DB connectivity | `SELECT 1` ok; `SELECT DATABASE()` = `airprod_dev` | **0** |
| Route smoke (HTTP) | `/`=200 · `/dashboard`=200 · `/jobs`=200 · `/jobs/JOB-001`=200 · `/clients`=200 · `/vendors`=200 · `/crew`=200 · `/finance`=200 · unknown=**404** | ok |
| Read-only DB safety enumeration | see J.10 (`information_schema` + `COUNT`) | ok |

Test breakdown (12 files, 278): `db-foundation` 22 · `mysql-repository` 22 ·
`domain-contract` 31 · `finance-service` 23 · `mysql-service-integration` 31 ·
`migration-planning` 46 · `migration-snapshot` 39 · `application-foundation` 7 ·
`application-conversion` 14 · `activation-readiness` 15 · `activation-gates` 22 ·
**`local-dev-runtime` 6**.

### J.9. Routes and flows smoke-tested (real browser E2E)

Testing was performed with the actual browser, driving the real UI and Server Actions
against `airprod_dev`. **This was genuine browser E2E**, not HTTP-level-only.

| # | Route | Result |
| --- | --- | --- |
| 1 | `/` → redirects to `/dashboard` (streamed `NEXT_REDIRECT;…;/dashboard;307`) | pass |
| 2 | `/dashboard` — summary + empty-state | pass |
| 3 | `/jobs` — list + create modal | pass |
| 4 | `/jobs/JOB-001` — tabs Overview/Crew/Delivery/Jadwal & Kas/Biaya | pass |
| 5 | `/clients` — master-data CRUD surface | pass |
| 6 | `/vendors` | pass |
| 7 | `/crew` — Crew **and** Crew Roles sections | pass |
| 8 | `/finance` — client schedule / vendor schedule / cash client / cash vendor / expenses / cashflow | pass |
| 9 | Unknown route → `/_not-found` | 404 |

| # | Scenario (task list) | Result |
| --- | --- | --- |
| A | Empty database state | dashboard/jobs/clients all render empty-state cleanly |
| B | Create master data | client “PT Uji Lokal”, vendor “Vendor Uji Lokal”, crew-role “Videographer”, crew “Andi” (Rp 1.500.000) |
| C | Create a job with the current **manual** job-number contract | `JOB-001` (client counterparty, 2026-11-01) |
| D | Assign crew and verify the crew **obligation** | Andi / Videographer / Kesepakatan Rp 750.000 / Terbayar Rp 0 / *Belum Dibayar* |
| E | Create payment schedules | client Termin 1 Rp 5.000.000; vendor DP Rp 400.000 |
| F | Record actual financial transactions | client payment Rp 2.000.000; crew payment Rp 750.000; expenses Rp 250.000 (job) + Rp 100.000 (jobless) |
| G | Verify **derived** payment statuses | client schedule → *Sebagian*; crew → *Sudah Dibayar* |
| H | Idempotent transaction replay | covered by the existing DB-backed idempotency tests (`finance-service`) + canonical service tests; in the UI the idempotency key is generated per submission, so replay is not user-triggerable — reported honestly, not re-driven in the browser |
| I | General expense **without** a job | recorded; `cashflows.job_id = NULL` (verified in DB) |
| J | Refresh / persistence | reloading `/clients` still shows “PT Uji Lokal” (row from DB, not client state) |
| K | Navigation between pages | sidebar navigation across all pages |
| L | Invalid input / error state | duplicate job number rejected in-modal: *“Job number 'JOB-001' sudah dipakai job lain.”* |

Browser console after the origin fix: **no application runtime errors** (only the
expected React DevTools info line and `[HMR] connected`).

### J.10. Database safety evidence

Read-only enumeration of all domain tables (excluding `__drizzle_migrations`) after the
full phase:

| Database | Tables | Journal | Data rows | Status |
| --- | --- | --- | --- | --- |
| `airprod_dev` | 13 | 2 (`0000`+`0001`) | clients 1 · vendors 1 · crew_roles 1 · crew 1 · jobs 1 · job_crews 1 · deliveries 1 · client_payments 1 · vendor_payments 1 · cashflows 4 | **development target — expected** |
| `airprod_test` | 13 | 2 | **0** (reset by the test workflow) | **isolated — untouched outside tests** |
| `database-airprod` | 13 | **1 (`0000` only)** | **0** | **protected — untouched** |

- No `DROP`/`TRUNCATE`/`RESET`/`SEED` and no migration was applied to `database-airprod`.
- No application test data was written into `database-airprod`.
- `airprod_dev` data was written **only** through the real application UI.
- The production `.env` URL was preserved (commented) rather than deleted, and no
  production credentials were placed into any tracked file.
- `cashflows` in `airprod_dev` confirm the canonical invariants: every row has an
  idempotency key, directions/categories are correct, reference types are set, and the
  jobless expense has `job_id = NULL`.

### J.11. Remaining limitations

1. **Authentication/authorization absent (P1A/P1B).** Local run is **private only** — no
   tunnel, no public exposure, no deploy. The shell's “Admin” label is **not** authentication;
   no fake credentials or bypass were added. Any feature genuinely needing auth is
   **BLOCKED BY P1A/P1B**.
2. **Manual job numbering (P2A).** Jobs require an explicit unique `jobNumber`.
3. **No schedule delete** in the canonical contract → finance UI is create+update only.
4. **`airprod_test` is shared and reset each run** — not durable; use `airprod_dev` for local data.
5. **E2E ran on the dev server**, not a production build; no deployed-environment verification.
6. **P0E-2B unchanged and still blocked** — off-host backup, window/operator/rollback owner
   and written approval remain outstanding (Sections E1c/E2, H.18, I.17).
7. Port 3000 was occupied by an unrelated project on this machine, so verification used 3001.

### J.12. Exact local startup instructions (verified)

```bash
# 0) MariaDB (Fedora) — already active in this environment
systemctl enable --now mariadb        # start + enable the service (needs admin rights)

# 1) (once) create the development database if it does not exist
mariadb -u root -p -e "CREATE DATABASE IF NOT EXISTS airprod_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 2) (once) apply the existing migrations to the development database ONLY
DATABASE_URL="mysql://<user>:<pass>@127.0.0.1:3306/airprod_dev" npm run db:migrate

# 3) confirm .env points DATABASE_URL at airprod_dev (already set; .env is git-ignored)

# 4) start the application
npm run dev                                   # default: http://localhost:3000

#    If port 3000 is busy (as on this machine), use:
#    PORT=3001 npm run dev                     # then open http://localhost:3001

# 5) open the printed URL in a browser (use the printed localhost URL)
#    -> Dashboard; navigate Jobs / Clients / Vendors / Crew / Finance

# 6) automated tests (always run against airprod_test)
npx vitest run

# 7) stop the server with Ctrl+C
```

*Verified in this phase:* step 4/5 with `PORT=3001 npm run dev` → `Ready`, `http://localhost:3001/dashboard` 200, full E2E flows, and `npx vitest run` → 278/278.

### J.13. Roadmap integrity (unchanged)

| Metric | Value | Note |
| --- | --- | --- |
| Completed milestones | **5 / 18 = 27.8 %** | **unchanged**; P0E-DEV-1 is a subphase of P0E, not a master milestone |
| Skipped (owner decision) | **1** | P0D |
| Remaining | **12** | P0E → P4B |
| Adjusted active-roadmap | **5 / 17 = 29.4 %** | denominator excludes the skipped milestone; **not** a gain |
| Production readiness | **4 / 10** | **unchanged** — local runtime success is **not** production readiness |
| Production `0001` | **not applied** | production untouched |
| P0E-2B | **NOT STARTED** | requires a **new written owner approval** |

### J.14. Final verdict

**PASS.** The application starts successfully against MariaDB, connects to the dedicated
development database `airprod_dev`, serves all active routes without uncaught runtime
errors, and exercises every implemented workflow through the real UI/Server-Action
boundary. All mandatory verification commands pass (**tsc 0 · lint 0 · db:check clean ·
278/278 tests · build exit 0 without credentials**). Two discovered defects (the test-DB
guard and the Next 16 dev-origin block) were root-caused, fixed, and regression-tested.
The protected `database-airprod` and the isolated `airprod_test` remain **untouched**.
**No production migration, no deployment, no runtime activation, no public exposure, and
no commit/push occurred.**

**STOP.** P0E-DEV-1 ends here. Do **not** proceed automatically to P1A/P1B, P0E-2B or
deployment; each requires a new explicit owner decision.
