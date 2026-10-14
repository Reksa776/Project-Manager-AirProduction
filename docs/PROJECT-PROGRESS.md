# PROJECT PROGRESS — Air Production Project Manager

**Last update:** 2026-10-14
**Updated by:** Phase **P0E-DEV-1 — Local Application Runtime Stabilization** (detailed report: [`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md); concise summary in **Section J**; Sections C, G, H and I keep the preserved P0E-1A / P0E-1B / P0E-2A / P0E-2A.1 reports)
**Branch / HEAD:** `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` (nothing committed/pushed)
**Reporting policy:** this file is the **master dashboard and report index**. **From P0E-DEV-1 onward every phase has its own separate detailed Markdown report** (see Sections R3 / R4); this file carries the dashboard plus a **concise summary and a link** for each phase. P0E-1A, P0E-1B, P0E-2A and P0E-2A.1 were recorded inline under the earlier single-file policy and are preserved verbatim in Sections C, G, H and I.

> **OWNER DECISION (authoritative): OPTION A — FRESH START MYSQL.**
> Historical Google Sheets data is **not required** and must **not** be migrated;
> MySQL/MariaDB is the intended sole active runtime database. This decision
> **supersedes** the historical migration objective of P0D and the source-access
> requirements of P0D-2A. It does **not** authorise deleting historical data,
> deleting any spreadsheet, dropping/resetting/truncating any database, applying
> production migrations, switching the runtime, or deploying — each of those
> still needs a **new, explicit owner approval**.

> This tracker distinguishes **milestone completion** from **production readiness**,
> and also distinguishes **SKIPPED BY OWNER DECISION** from completed work.
> A completed milestone means the phase's own acceptance criteria were met and
> verified; it does **not** mean the feature is live. A skipped milestone is **not**
> counted as technically completed. Only phases with a written, verified report
> are counted.

> **Phase-reporting rule (mandatory from now on):** every subsequent agent phase must
> include updating this dashboard **and** producing its **own separate detailed report**
> (under `docs/reports/`) in its **initial scope** and in its **final acceptance
> criteria**; this file keeps only the dashboard plus a **concise summary and a link**.

> **P0E-1A scope note (historical):** that phase prepared and verified the canonical
> MySQL application integration **foundation only**. It did **not** switch the runtime,
> touch the production database, convert any page/action, apply migration `0001`,
> or request Google credentials.

> **P0E-1B scope note (historical):** that phase **converted the active application
> consumers** to canonical Contract v2 through one composition boundary
> (`src/services/runtime.ts`), removed the legacy Google Sheets repository seam from
> the runtime, made the root layout credential-free and I/O-free, and **made
> `npm run build` exit 0 with no `GOOGLE_*` credential present**.

> **P0E-2A scope note:** this phase is a **readiness and rehearsal phase**. It audited
> the migration runner/journal/guards/runbook, ran the read-only production preflight,
> executed a **backup → restore → `0001` → verification → repeat-safety rehearsal in an
> isolated disposable database** (`airprod_rehearsal`, created and dropped), and
> produced the P0E-2B execution gate. It did **not** apply `0001` to
> `database-airprod`, did not write or activate production, did not deploy or expose
> anything, and did not request Google credentials. **One sub-criterion is BLOCKED:**
> an **off-server** backup copy cannot be created or verified in this environment
> (Section H.5). P0E remains **IN PROGRESS**; **P0E-2B is NOT STARTED** and
> approval-gated.

---

## SECTION A — MASTER PROJECT DASHBOARD

| Item | Value |
| --- | --- |
| **Current phase** | **P0E-DEV-1 — Local Application Runtime Stabilization** (local-development subphase of P0E; the most recent *gated* phase remains P0E-2A.1) |
| **Current verdict** | **P0E-DEV-1 = PASS** — the existing application runs locally against the dedicated development database `airprod_dev`: real browser E2E on all 6 dynamic routes + all implemented workflows (master data, job, crew obligation + cash, client/vendor schedules, derived statuses, delivery, jobless expense, duplicate-key error path); 278/278 tests; tsc 0; lint 0; `db:check` clean; build exit 0 with no `GOOGLE_*`. The previous phase's verdict stands separately: **P0E-2A.1 = PASS WITH LIMITATIONS** (destination **NOT OFF-HOST**; off-host acceptance STOPPED) — detailed P0E-DEV-1 report in the separate file [`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md) (see **Section J** summary), and the P0E-2A.1 report in **Section I** |
| **Next proposed phase** | **P0E-2B — Production `0001` Rollout & Activation Gate** (NOT STARTED, requires a new written owner approval) |
| Completed milestones | **5 / 18** (P0A, P0B, P0C-1, P0C-2, P0C-3) — **unchanged**; P0E-1B is a subphase and does **not** complete P0E |
| Skipped milestones | **1** (P0D — owner decision) |
| Remaining milestones | **12** (P0E → P4B) |
| Historical progress | **5 / 18 = 27.8 %** — **unchanged** |
| Adjusted execution progress | **5 / 17 = 29.4 %** (denominator excludes the skipped milestone; **not** a gain) |
| Production readiness | **4 / 10** — was 3/10; the **only** change is criterion "build green without external credentials", now satisfied by evidence (`npm run build` exit 0 with `GOOGLE_*` unset) — Sections G.16 / G.22 / R2 |
| Latest test result | **278 / 278** (12 files) — was 272/272; **+6 focused P0E-DEV-1 local-runtime guard/origin regression tests** (`tests/local-dev-runtime.test.ts`), no existing test deleted, skipped, or weakened |
| Local development database | **`airprod_dev`** — created in this phase, migrated with `0000` + `0001` (journal = 2), holds the local smoke-test data. **Separate** from `database-airprod` (protected, journal `0000`, 0 rows) and `airprod_test` (isolated, reset by tests) |
| Local application runtime | **RUNNING** (`next dev` on `http://localhost:3001`) against canonical MySQL Contract v2 → `airprod_dev`; every active route loads and every implemented workflow was exercised in a real browser |
| TypeScript | **0 errors** (`npx tsc --noEmit`, exit 0) |
| Lint | **0 errors, 0 warnings** (`npm run lint`, exit 0) — the former pre-existing `job-actions.ts` unused-import warning disappeared when that file dropped the legacy type import |
| `db:check` | **Clean** (`Everything's fine 🐶🔥`) — exit 0 |
| Build | **PASS — exit 0 without any `GOOGLE_*` credential present** (this was the inherited P0E-1A blocker and the top P0E-1B acceptance criterion) |
| Active application runtime | **Canonical MySQL Contract v2** through the single composition boundary `src/services/runtime.ts` → `createApplicationBackend()`; the Google Sheets repository seam is **gone from the runtime path** |
| Production database | `database-airprod` — **14 tables, all 0 rows**, journal = `0000` only (read-only preflight, exit 0) — **untouched**; rehearsal re-run in P0E-2A.1 passed **26/26** on the disposable `airprod_rehearsal`, created and dropped; the **DB host is local (`LOOPBACK`)** |
| Migration `0001` status | **Not applied** to production; still required for canonical financial writes (separate approval; P0E-2) |
| Critical blockers | **Backup destination is NOT OFF-HOST** (owner chose the local laptop/PC, which is the same machine as the DB host → off-host acceptance STOPPED; a separate destination decision is required); production `0001` rollout + activation not approved (P0E-2B); maintenance window/operator/rollback owner unassigned; authentication/authorization (P1A/P1B); automatic job numbering (P2A); remaining business UI (P2B–P2E); database provider/pooling decision (D-CONN-1/D-CONN-2) |

---

## SECTION B — MASTER ROADMAP (18 ORIGINAL MILESTONES, PRESERVED)

| # | Phase | Status | Classification | Evidence |
| --- | --- | --- | --- | --- |
| 1 | P0A — MySQL Foundation Recovery | PASS WITH LIMITATIONS | ✅ COMPLETED | `docs/PHASE-P0A-MYSQL-RECOVERY.md` |
| 2 | P0B — MySQL Repository Implementation | PASS WITH LIMITATIONS | ✅ COMPLETED | `docs/PHASE-P0B-MYSQL-REPOSITORY.md` |
| 3 | P0C-1 — Domain & Contract Reconciliation | PASS WITH LIMITATIONS | ✅ COMPLETED | `docs/PHASE-P0C1-DOMAIN-RECONCILIATION.md` |
| 4 | P0C-2 — Financial Repository & Services | PASS WITH LIMITATIONS | ✅ COMPLETED | `docs/PHASE-P0C2-FINANCIAL-REPOSITORY.md` |
| 5 | P0C-3 — MySQL Service Integration | PASS WITH LIMITATIONS | ✅ COMPLETED | `docs/PHASE-P0C3-MYSQL-SERVICE-INTEGRATION.md` |
| 6 | P0D — Historical Data Migration | P0D-1 **PASS WITH LIMITATIONS** · P0D-2A **BLOCKED ON SOURCE ACCESS** · P0D-2B **CANCELLED / NOT REQUIRED** | ⏭️ **SKIPPED — OWNER DECISION: FRESH START MYSQL** | `docs/PHASE-P0D1-MIGRATION-PLANNING.md`, `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md`, `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md` |
| 7 | P0E — MySQL Activation | **IN PROGRESS** — P0E-1A done (Section C); P0E-1B done (Section G); P0E-2A done (Section H); P0E-2A.1 done (Section I); **P0E-DEV-1 done (separate report + Section J summary — local runtime stabilized)**; P0E-2B rollout/activation not started | ⏳ REMAINING | this file (Sections C, G, H & I) · [`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md) · `docs/FRESH-START-MYSQL-PLAN.md` |
| 8 | P1A — Authentication Foundation | PENDING | ⏳ REMAINING | — |
| 9 | P1B — Authorization & Security | PENDING | ⏳ REMAINING | — |
| 10 | P2A — Jobs & Automatic Job Number | PENDING | ⏳ REMAINING | — |
| 11 | P2B — Master Data & Crew Roles | PENDING | ⏳ REMAINING | — |
| 12 | P2C — Crew Assignment & Payment | PENDING | ⏳ REMAINING | — |
| 13 | P2D — Finance & Cashflow UI | PENDING | ⏳ REMAINING | — |
| 14 | P2E — Dashboard & Delivery | PENDING | ⏳ REMAINING | — |
| 15 | P3A — UI/UX Finalization | PENDING | ⏳ REMAINING | — |
| 16 | P3B — Automated & E2E Testing | PENDING | ⏳ REMAINING | — |
| 17 | P4A — Vercel Production Preparation | PENDING | ⏳ REMAINING | — |
| 18 | P4B — Deployment & Final Acceptance | PENDING | ⏳ REMAINING | — |

### Required classification reports

1. **Completed technical milestones (5):** P0A, P0B, P0C-1, P0C-2, P0C-3 — all recorded **PASS WITH LIMITATIONS** in their own reports; verdicts preserved, not rewritten.
2. **Skipped by owner decision (1):** **P0D — Historical Data Migration** (P0D-1 historical **PASS WITH LIMITATIONS**, P0D-2A historical **BLOCKED ON SOURCE ACCESS**, P0D-2B **cancelled/not required**). Historical results preserved as evidence.
3. **Remaining (12):** P0E (in progress), P1A, P1B, P2A, P2B, P2C, P2D, P2E, P3A, P3B, P4A, P4B.
4. **Historical completion percentage: 5/18 = 27.8 %** — **unchanged**. A SKIPPED milestone is **not** counted as technically completed.
5. **P0E-1A, P0E-1B, P0E-2A, P0E-2A.1 and P0E-DEV-1 are subphases and do NOT count as separate master milestones.** P0E is **IN PROGRESS**, not completed. Passing P0E-2A **or P0E-DEV-1** therefore **does not** change 5/18 or 5/17.
6. **Production readiness checklist:** see the reference appendix — **4/10** (updated in P0E-1B; the sole moved item is "build green without external credentials").

### Progress metrics — denominators defined explicitly

| Metric | Value | Denominator definition |
| --- | --- | --- |
| **Historical completion** | **5 / 18 = 27.8 %** | All 18 original milestones; only technically completed ones count. P0E-1A / P0E-1B / P0E-2A are subphases and do **not** change this. |
| Skipped by owner decision | 1 / 18 | P0D (historical migration) — excluded from completion. |
| Remaining to acceptance | 12 / 18 | P0E → P4B. |
| **Adjusted active-roadmap completion** | **5 / 17 = 29.4 %** | Denominator = 18 − 1 skipped = **17**. Labelled **separately** and **not** a progress gain. |

### P0E subphase tracker (new)

| Subphase | Status | Evidence |
| --- | --- | --- |
| **P0E-1A — MySQL Application Integration Foundation** | **PASS WITH LIMITATIONS** (historical) | this file, Section C |
| **P0E-1B — Canonical MySQL Runtime Consumer Conversion** | **PASS** (historical) | this file, Section G |
| **P0E-2A — Production Activation Readiness & Restore Rehearsal** | **PASS WITH LIMITATIONS** (off-server backup copy BLOCKED) — historical | this file, Section H |
| **P0E-2A.1 — Activation Gate Hardening & Local-PC Backup Preparation** | **PASS WITH LIMITATIONS** (destination **NOT OFF-HOST**; off-host acceptance STOPPED pending a separate destination decision) | this file, **Section I** |
| **P0E-DEV-1 — Local Application Runtime Stabilization** | **PASS** — application runs locally against a dedicated development database (`airprod_dev`); all active routes + implemented workflows exercised end-to-end in a real browser | [`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md) (summary in this file, Section J) |
| P0E-2B — Production `0001` rollout + controlled runtime activation | **NOT STARTED** (requires new written owner approval) | Section **H.18** · Section **I.17** · Section F9 · `docs/MIGRATION-RUNBOOK.md` Part A |

### P0D subphase tracker (historical, preserved)

| Subphase | Status | Evidence |
| --- | --- | --- |
| P0D-1 — Migration Planning & Reconciliation | **PASS WITH LIMITATIONS** (historical) | `docs/PHASE-P0D1-MIGRATION-PLANNING.md` |
| P0D-2A — Real source snapshot & reconciliation gate | **BLOCKED ON SOURCE ACCESS** (historical; tooling and tests delivered) | `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` |
| P0D-2B — Approved import | **CANCELLED / NOT REQUIRED** (owner decision, Fresh Start MySQL) | `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md` |
| P0D-CLOSE — Roadmap revision & Fresh Start transition planning | **PASS (documentation & read-only verification)** | `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md` |

---

## SECTION C — PHASE REPORT: P0E-1A (HISTORICAL, PRESERVED)

> **Status note added by P0E-1B:** the report below is preserved **verbatim**. Two of
> its “carried-forward” items are now closed by P0E-1B: the build failure (C9) and the
> Google Sheets runtime seam (C4 item 10). Everything else it records stays as
> written; P0E-1B's own report is Section G.

**Verdict: PASS WITH LIMITATIONS.** The canonical MySQL application composition
foundation is implemented and verified against the isolated test database; the
active runtime, production database, and every consumer remain untouched. The one
failure (`npm run build`) is the pre-existing Google Sheets prerender dependency,
reported separately and carried to P0E-1B.

### C1. Phase objective and scope

**Objective:** prepare and verify the canonical MySQL application integration
foundation **without** switching the currently active application runtime.

**In scope (executed):** inspect the real repository; build the code-grounded
legacy consumer inventory and verify the blocked-method count; implement the
missing **application-level composition foundation** (explicit DI, lazy
connection, single shared pool, isolated test-DB support) reusing
`createCanonicalMySqlRepositories()` / `createMySqlApplication()`; add focused
isolated-test-DB tests; verify empty-database compatibility; analyse the Google
Sheets build dependency chain; document `0001` prerequisites; review
Vercel/MySQL connectivity; run the full verification suite; consolidate all of it
into this single file.

**Out of scope (not done):** P0E-1B implementation; P0E-2; auth (P1A/P1B); job
numbering (P2A); new business features; historical Sheets migration; production
deployment/migration/seeding; automatic runtime switching; any `getRepositories()`
change.

### C2. Baseline branch, HEAD, and working-tree safety

| Item | Baseline (verified) |
| --- | --- |
| Branch / HEAD | `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` — unchanged at end of phase |
| HEAD subject | `fix: restore job actions and update database foundation` |
| Working tree at start | **55** changed/untracked paths (P0A→P0D-CLOSE work preserved) |
| Working tree at end | **58** paths (= 55 + 3 new files added by this phase) |
| Reset / stash / clean / revert / discard | **None** |
| Commit / push / deploy | **None** |
| Database writes | **None** — production touched only by the read-only preflight (SELECT/`information_schema`) |
| Google Sheets access | **None** — no read, no write, no credential request |
| Pre-existing `dotenv` delta | `package.json`/`package-lock.json` carry a pre-existing uncommitted `dotenv ^18.0.7` addition (in sync). **Inspected, documented, not modified** — no dependency was added, removed, or reinstalled. |

All baseline values were re-verified against the real repository rather than trusted.

### C3. Files created and modified

**Created (source + tests — permitted; the one-file rule applies to reports/docs only):**

| File | Purpose |
| --- | --- |
| `src/db/connection.ts` | Explicit connection lifecycle: `sharedConnection()` (reuses the runtime `getDb()` pool) and `isolatedConnection(url)` (owned, lazy, idempotently disposable). No Google Sheets, no credential reads. |
| `src/services/application.ts` | **Application-level composition foundation**: `createApplicationBackend({ connection? })` builds the canonical backend (repositories + canonical services + financial) over an injected connection. Pure composition + DI; not wired to runtime. |
| `tests/application-foundation.test.ts` | 7 focused isolated-test-DB tests (lazy construction, pool reuse, isolated lifecycle, full surface, empty-DB behaviour, error propagation, no-Google boundary). |

**Modified (one source file, which already carried prior-phase changes):**

| File | Change |
| --- | --- |
| `src/db/index.ts` | **This phase's delta only:** exported the previously private handle factory as `DbHandle` + `createDatabaseHandle(url)` (plus its JSDoc), and `getDb()` now calls `createDatabaseHandle(getDatabaseUrl())`. Behaviour identical: one lazy, `globalThis`-cached pool per process, same options (`connectionLimit: 10`, `dateStrings`, UTC `time_zone`). Enables explicit isolated connections **without** duplicating pool configuration. |

> **Clarification on `src/db/index.ts`:** this file was **already modified before P0E-1A** — it is one of the 55 baseline paths (it holds the PostgreSQL→MySQL rework from P0A/P0B, so a `git diff` against HEAD shows that pre-existing rework too). P0E-1A's delta to it is limited to the export refactor above; no pool option, query, listener, or `getDb()`/`closeDb()` behaviour was changed.

**Modified (documentation):**

| File | Change |
| --- | --- |
| `docs/PROJECT-PROGRESS.md` | This consolidated P0E-1A report (Sections A–F); roadmap, DB status, readiness checklist, history, and prior verdicts preserved. |

**Not modified:** `src/repositories/index.ts` (`getRepositories()`), all Google
Sheets code, all pages/layouts/Server Actions, all legacy services, every schema
file, every migration file, `package.json`, `tsconfig.json`, and every existing
test file. **No existing test was changed, skipped, or weakened.**

### C4. Canonical composition architecture

The foundation **reuses** the existing canonical implementation instead of
introducing a competing abstraction:

```
ApplicationBackend  (src/services/application.ts)          ← NEW (foundation only)
  ├─ connection: ApplicationConnection                     ← NEW (src/db/connection.ts)
  │    ├─ sharedConnection()  → getDb()  (ONE runtime pool, reused; dispose = no-op)
  │    └─ isolatedConnection(url) → owned pool (lazy; disposed idempotently)
  ├─ repositories: CanonicalMySqlRepositories               (existing: createCanonicalMySqlRepositories)
  ├─ financial:    FinancialService                         (existing: createFinancialService)
  └─ services:     CanonicalServices                        (existing: createCanonicalServices,
                                                             via createMySqlApplication)
```

How each P0E-1A requirement is met:

| # | Requirement | How |
| --- | --- | --- |
| 1 | Reuse Contract v2 | Only calls `createMySqlApplication()` → `createCanonicalMySqlRepositories()`; no new repository interfaces. |
| 2 | No competing abstraction | `src/repositories/mysql/**` and the canonical services are used as-is; the new module adds composition, not repositories. |
| 3 | Explicit dependency injection | `createApplicationBackend({ connection })`; default `sharedConnection()`. |
| 4 | No connection at import | `createDatabaseHandle` is lazy (mysql2 pool); `resolve()` is called per operation; verified by test. |
| 5 | Clear connection lifecycle | `ApplicationConnection.resolve()/dispose()`; backend exposes `dispose()`; `shared` dispose is a deliberate no-op. |
| 6 | Reuse the existing connection | `sharedConnection()` returns `getDb()` — the same cached instance (verified by identity). |
| 7 | No accidental duplicate pools | Default path never creates a pool; only `isolatedConnection(url)` creates one, and it is explicitly disposed. |
| 8 | No Google Sheets fallback | Composition path imports no Google module (test-enforced by comment-stripped source scan). |
| 9 | No credentials exposed | No env reading in the new modules; `DATABASE_URL` stays in `src/db/env.ts` and is never printed. |
| 10 | Explicit, separately gated activation | Nothing calls the foundation; `getRepositories()` unchanged. Activation = P0E-1B change at one seam. |
| 11 | Isolated test-DB integration | `isolatedConnection(testUrl)` + the existing `airprod_test` harness. |
| 12 | Financial invariants preserved | The single `createFinancialService` instance is shared by `services.financial` and `financial` (verified by identity); no financial logic duplicated. |
| 13 | Next.js compatibility | Returns a plain object with no construction-time I/O; safe to import from server code. |
| 14 | No unnecessary dependencies / refactor | No new npm dependency; the only source edit is an export of an existing private helper. |

### C5. Complete legacy application consumer inventory (code-grounded)

**Build-time / source-of-truth:**

| # | File path | Current dependency | Required business operation | Canonical Contract v2 equivalent | Domain/semantic incompatibility | Blocks build without Sheets creds? | Conversion approach | Target phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/layout.tsx` (`:30` `getCurrentAdmin()`) | `services/master-service` → `getRepositories().admins` → Google client | Show current admin name in the shell | `services.adminSessions.listAdmins()` | None structural; canonical `admins` is empty (returns `null` → `"Admin"` fallback) | **YES** — every route incl. `/_not-found` | Stop reading during build: render dynamically / move the admin lookup off the prerendered layout path | P0E-1B |
| 2 | `src/app/page.tsx` | none (`redirect`) | Redirect to dashboard | n/a | none | No | — | — |

**Pages (all statically prerendered; all block the build):**

| # | File path | Current dependency | Required business operation | Canonical equivalent | Incompatibility | Blocks build? | Conversion approach | Target phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | `src/app/dashboard/page.tsx` | `dashboard-service.getDashboardData()` (jobs, clients, vendors, **venues**, deliveries) | Job summary + upcoming weddings + upcoming editing | `services.jobs.listJobs`, `services.master.list*`, `services.deliveries.listDeliveries` | **Venue**; no canonical dashboard service; venue name on rows | **YES** | Compose from canonical lists; drop venue (use `job.legacyVenueName` if a name is still shown) | P0E-1B (full dashboard = P2E) |
| 4 | `src/app/jobs/page.tsx` | `job-service.getJobListItems()` + `master-service.getClients/getVendors/getVenues` | Job list + counterparty + venue picker | `services.jobs.listJobs`, `services.master.listClients/listVendors` | **Venue** picker; legacy view model | **YES** | Use canonical lists; remove venue from the job form | P0E-1B |
| 5 | `src/app/jobs/[jobNumber]/page.tsx` | `job-service.getJobDetail()` + `master-service.getClients/getVendors/getVenues/getCrew` | Full job detail incl. crew, deliveries, payments, expenses, venue | `services.jobs.getJobDetail` (job, counterparty, schedules, crewAssignments, deliveries, **cashflows**) + `services.master.listCrewDirectory` | **Venue**, **expenses**, stored payment **status**, free-text crew **role**, `paymentStatus` on assignment | **YES** | Map to canonical detail; derive status; crew-role selection | P0E-1B |
| 6 | `src/app/clients/page.tsx` | `master-service.getClients()` | Client master CRUD | `services.master.listClients/createClient/updateClient/deleteClient` | Legacy fields (`name/address/phone/notes`) vs canonical (`companyName/contactPerson/email/clientType`) | **YES** | Rebuild on canonical client fields | P0E-1B (form = P2B/P2D) |
| 7 | `src/app/vendors/page.tsx` | `master-service.getVendors()` | Vendor master CRUD | `services.master.listVendors/...` | Minor field naming | **YES** | Rebuild on canonical vendor fields | P0E-1B |
| 8 | `src/app/crew/page.tsx` | `master-service.getCrew()` | Crew master CRUD | `services.master.listCrewDirectory/createCrew/...` + `crewRoles` | Free-text **role** vs `crewRoleId` FK | **YES** | Crew forms select/create a `crew_roles` entry | P0E-1B (role UI = P2B) |
| 9 | `src/app/venues/page.tsx` | `master-service.getVenues()` | Venue master CRUD | **none — no venue entity** | **Hard**: no `venues` table | **YES** | Remove from the active UI (route redirect/removal + nav update). **No fake venue repository.** | P0E-1B |
| 10 | `src/app/finance/page.tsx` | `master-service.getFinanceOverview()` (jobs, clients, vendors, clientPayments, vendorPayments, **expenses**) + `job-service.getJobListItems()` | Finance listing/totals | `financial.create*/update*Schedule`, `financial.readCashflows`, `financial.record*`, derived statuses | **Expenses → cashflows**; stored **status** vs derived; no canonical finance page service | **YES** | Rebuild on schedules + cashflows; show **derived** status; drop the venue/expense dependencies | P0E-1B (full UI = P2D) |

**Server Actions (write path — not prerendered, so they do not block the build, but they block runtime conversion):**

| # | File path | Current dependency | Required business operation | Canonical equivalent | Incompatibility | Target phase |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | `src/app/actions/master-actions.ts` | `master-service` CRUD (clients, vendors, **venues**, crew) | Master-data writes | `services.master.*` | Venue create/update/delete; crew free-text role | P0E-1B |
| 12 | `src/app/actions/job-actions.ts` | `job-service.createJob/updateJob/deleteJob` | Job writes | `services.jobs.createJob/updateJob/deleteJob` | `venueId`; manual `jobNumber` (auto-numbering = P2A); XOR client/vendor enforced by canonical repo | P0E-1B (auto-number = P2A) |
| 13 | `src/app/actions/job-detail-actions.ts` | `job-service` (job-crew, delivery) + **direct `getRepositories()` import** (`:13`, for `revalidatePath`) | Crew assignment + delivery writes | `repositories.jobCrewAssignments`, `services.deliveries`, `services.jobs.getJobById` | `paymentStatus`; free-text role; **direct `@/repositories` barrel import must be removed** | P0E-1B |
| 14 | `src/app/actions/finance-actions.ts` | `job-service` client/vendor payment + **expense** CRUD | Payment/expense writes | `financial.create*/update*Schedule`, `financial.record*`, `financial.recordGeneralExpense` | Stored **status**; **expenses** | P0E-1B |

**Shared components (client components; receive data/actions via props — no repository imports):**

| # | File path | Current dependency | Note |
| --- | --- | --- | --- |
| 15 | `src/components/jobs/jobs-table.tsx` | `@/lib/types` (`JobStatus`), `@/services/types` (`JobListItem`) | Legacy **type** coupling only |
| 16 | `src/components/jobs/job-detail-tabs.tsx` | `@/lib/types` (`Crew`, `JobCrew`, `PaymentStatus`), `@/services/types` (`JobDetail`) | Legacy type coupling; consumes payment `status` |
| 17 | `src/components/jobs/edit-job-button.tsx` | `@/lib/types` (`Job`) | Venue fields in the form |
| 18 | `src/components/master/master-crud.tsx` | none | Generic; data/actions passed in |
| 19 | `src/components/finance/finance-crud.tsx` | none | Generic; data/actions passed in |
| 20 | `src/components/ui/status-badge.tsx` | `@/lib/types` (`DeliveryStatus`, `JobStatus`) | Type coupling; job/delivery statuses same in canonical |
| 21 | `src/lib/labels.ts` | `@/lib/types` | Label maps incl. legacy expense categories |

**Application services (the actual legacy seam):**

| # | File path | Current dependency | Required business operation | Canonical equivalent | Incompatibility | Target phase |
| --- | --- | --- | --- | --- | --- | --- |
| 22 | `src/services/master-service.ts` | `getRepositories()` (`:1`) | Master CRUD + current admin + **finance overview** | `services.master`, `services.adminSessions` | Venue, expenses, legacy Client fields | P0E-1B (rebuilt or deleted with its UI) |
| 23 | `src/services/job-service.ts` | `getRepositories()` | Job + relations CRUD, job list/detail | `services.jobs`, `services.deliveries`, `repositories.*` | Venue, expenses, stored status, `paymentStatus`, free-text role | P0E-1B |
| 24 | `src/services/dashboard-service.ts` | `getRepositories()` | Dashboard aggregation | compose from canonical lists | Venue | P0E-1B / P2E |
| 25 | `src/services/shared.ts` | `@/lib/types` (types only) | `buildLookup`, `resolveCounterparty` | reusable as-is (type-only) | none | keep |
| 26 | `src/services/types.ts` | `@/lib/types` (types only) | Legacy view models | replace with canonical shapes | type coupling | P0E-1B |

**Build/prerender-time data access:** the root layout (#1) plus the 8 data-reading
pages (#3–#10). **No page declares `dynamic` or `revalidate`**, so all are
statically prerendered and all fail without credentials.

### C6. Verified canonical Contract v2 coverage

Re-verified from source (`src/repositories/mysql/canonical/factory.ts`,
`CONTRACT_V2_METHODS`): **12 / 12 members**, **59 methods** total — jobs 6,
clients 5, vendors 5, crew 5, crewRoles 5, deliveries 6, jobCrewAssignments 6,
clientPaymentSchedules 6, vendorPaymentSchedules 6, cashflows 4, admins 2,
sessions 3. The existing integration test additionally asserts every method is a
function and that no repository is a throwing placeholder.

**Legacy-adapter blocked-method count — corrected to the actual number.**

| Method group | Count | Reason | Canonical replacement | Conversion target |
| --- | --- | --- | --- | --- |
| `venues.*` (`getAll`, `getById`, `create`, `update`, `delete`) | **5** | No `venues` table; concept removed | none (UI removed; `Job.legacyVenueName` for free text) | P0E-1B |
| `expenses.*` (`getAll`, `getById`, `getByJobId`, `create`, `update`, `delete`) | **6** | No `expenses` table; replaced by `cashflows` (direction=EXPENSE) | `financial.recordGeneralExpense` + `repositories.cashflows.query` | P0E-1B |
| `clientPayments.create/update/delete` | **3** | Legacy contract requires a **stored** `status`; canonical derives it from cashflows | `financial.createClientPaymentSchedule` + `recordClientPayment` + `deriveClientPaymentStatus` | P0E-1B |
| `vendorPayments.create/update/delete` | **3** | Same as client payments | `financial.createVendorPaymentSchedule` + `recordVendorPayment` | P0E-1B |
| **Total** | **17** | All throw `RepositoryBlockedError` (never an empty array or fake success) | — | — |

**Discrepancy recorded (documentation vs code):** `docs/PROJECT-PROGRESS.md` §3/§5
and `docs/FRESH-START-MYSQL-PLAN.md` §3 previously said **19** blocked methods;
`docs/PHASE-P0B-MYSQL-REPOSITORY.md`, `docs/PHASE-P0C1-DOMAIN-RECONCILIATION.md`
and `docs/PHASE-P0C3-MYSQL-SERVICE-INTEGRATION.md` correctly say **17**. The
source contains exactly **17** `RepositoryBlockedError` throws (5+6+3+3). The
actual current number is **17**; this report and the appendix use 17. No fake
compatibility method was added, and no legacy entity was resurrected.

Note: the legacy **read** methods for `clientPayments`/`vendorPayments` *are*
implemented (status derived from cashflows); only their writes are blocked.

### C7. Empty-database compatibility (Fresh Start)

Verified against a database created purely by migrations with **zero rows**
(no seed, no historical data). Tests: `tests/application-foundation.test.ts` #5/#5b.

| Check | Result |
| --- | --- |
| Empty clients / vendors / crew / crewRoles / jobs / deliveries | `[]` (valid empty) — no fabricated records |
| Empty job-crew assignments / client & vendor schedules / cashflows | `[]` |
| Empty admins / sessions | `[]` → `getCurrentAdmin()` style reads yield `null` |
| Canonical list services on empty data | `listClients()`, `listJobs()`, `listDeliveries()`, `listCrewDirectory()` all `[]` |
| Empty financial aggregate | `cashflows.totals({})` = `{ income: "0.00", expense: "0.00", net: "0.00" }`; `getJobFinancialSummary(<random>)` = all `"0.00"` (canonical decimal, not `NaN`) |
| Missing historical venue | Not applicable — no venue entity; nothing reads a venue dictionary |
| Missing historical crew-role dictionary | `crewRoles` is empty → `listCrewDirectory()` returns `[]`; crew creation requires an existing role (explicit error, not implicit creation) |
| No historical Sheets snapshot | Not required on the Fresh Start path |
| Missing referenced record | `getById`/`getByJobNumber` → `null`; `deriveClientPaymentStatus(<random>)` → `RepositoryNotFoundError`; `jobs.getJobDetail(<random>)` → `CanonicalServiceError` — **explicit errors, never silent fallbacks** |

Domain validation and database constraints were **not** weakened, and no admin
account, sample job, payment, or other production data was created.

**Note on dashboard statistics:** the canonical layer has **no dashboard service**
yet, so "empty dashboard statistics" is covered by the empty canonical job/delivery
lists that a future dashboard will compose from; a canonical dashboard service is
P0E-1B (basic) / P2E (full) work, not part of this phase.

### C8. Isolated integration-test evidence

`tests/application-foundation.test.ts` — **7 tests, all passing**, run only against
`airprod_test` (setup: `CREATE DATABASE IF NOT EXISTS airprod_test` → drop all
tables → apply migrations; `resolveTestDatabaseUrl` refuses any URL not pointing at
the production name before switching, so production is never a test target).

| # | Verified behaviour | Evidence |
| --- | --- | --- |
| 1 | Canonical application construction is import/construction-safe | Injected probe counter is `0` after construction, `> 0` after the first read |
| 2 | Dependency injection + shared-pool reuse | `resolveDatabase()` === `getDb()` (same instance); `dispose()` on a `shared` connection is a no-op and the runtime pool still works |
| 3 | Connection lifecycle + test isolation | `isolatedConnection(testUrl)` asserts the URL database is `airprod_test`, reads successfully, `dispose()` is idempotent, and `resolve()` after dispose throws |
| 4 | Shared repository/service instances | Backend exposes all 12 repository members, the canonical services, and `services.financial === financial` (one financial instance) |
| 5 | Empty-database behaviour (C7) | All reads empty; aggregates `"0.00"` |
| 5b | Correct error propagation | `null` for missing reads; `RepositoryNotFoundError` / `CanonicalServiceError` for missing references |
| 6 | No Google Sheets dependency in the composition path | Comment-stripped source scan of `src/services/application.ts` + `src/db/connection.ts` finds no `@/repositories/google`, `@/lib/google-sheets`, `@/lib/types`, `@/repositories/types`, `@/repositories/index`, and no `getRepositories(` call |

Migration `0001` is **not** required for these tests: `tests/setup.ts` applies all
migrations from `drizzle/` to `airprod_test`, and `0001` is already part of that
chain. `0001` was applied **only** to the isolated test database, never to
`database-airprod`.

### C9. Google Sheets build dependency analysis

`npm run build` → **exit 1**; compile ✓, TypeScript ✓ (38.7 s), then the static
prerender step fails. Verified chain (from the actual build log):

```
next build → prerender "/_not-found"
  src/app/layout.tsx:30        await getCurrentAdmin()
  src/services/master-service.ts:37   getRepositories().admins.getAll()
  src/repositories/google/index.ts:329  admins.getAll
  src/lib/google-sheets/client.ts:26  throw
  → "Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi pada environment."
```

The root layout reads data, so **every** route (including `/_not-found`) needs
credentials at build time. The 8 data pages (#3–#10 in C5) read data again at
prerender. This is **pre-existing** (P0A onward), **unchanged** by P0E-1A, and
**not** caused by the new foundation module (which is imported only by tests).
No fake `GOOGLE_SHEETS_ID`, mock credential, error suppression, or fabricated
record was added, and the active repository was not silently changed.

### C10. Migration `0001` prerequisites (read-only)

**Current production state (read-only preflight, exit 0):** database
`database-airprod`; **14 tables, all 0 rows**; applied journal = **`0000` only**;
`cashflows.job_id` **NOT NULL**; `idempotency_key` / `idempotency_fingerprint`
**absent**; no UNIQUE on `idempotency_key`; FK `cashflows_job_id_jobs_id_fk`
intact; `crew.default_payment = 0.00`, `job_crews.agreed_amount = 0.00`; **no
schema drift**.

**`0001` contents** (`drizzle/0001_dizzy_sunspot.sql`, 6 statements, additive):
`cashflows.job_id` → nullable; `crew.default_payment` / `job_crews.agreed_amount`
→ `NOT NULL DEFAULT '0.00'`; add `idempotency_key varchar(190)`; add
`idempotency_fingerprint char(64)`; add `CONSTRAINT uq_cashflows_idempotency_key
UNIQUE(idempotency_key)`.

**Why `0001` is required:** the canonical cashflow repository inserts
`idempotencyKey` + `idempotencyFingerprint` on every row and permits `jobId: null`
(`src/repositories/mysql/finance/cashflows.ts`), and the schema declares the two
columns plus `uniqueIndex("uq_cashflows_idempotency_key")`
(`src/db/schema/cashflows.ts`). Without `0001`, canonical cashflow/expense writes
fail and jobless expenses cannot be stored → **hard precondition**.

**Documented (not performed):** (1) production schema state above; (2) journal =
`0000`; (3) the exact reason above; (4) safe preconditions — `db:check` clean,
journal = `0000`, row-count baseline captured, apply to **`airprod_test`
first** and re-verify; (5) backup requirements — logical dump stored outside the
server with a recorded checksum; (6) restore rehearsal — restore the dump into a
throwaway database and verify row counts/schema; (7) rollback — `0001` has **no
down-migration**, so rollback = restore the pre-migration dump; the provider
switch itself rolls back by reverting the single provider seam; (8) **explicit
owner approval** naming window, operator, backup location, and go/no-go.

**No approval has been given; `0001` remains unapplied to production.** Production
rollout belongs to the separately approved **P0E-2** gate.

### C11. Vercel connectivity considerations (analysis only)

| Aspect | Finding |
| --- | --- |
| Node.js runtime compatibility | `mysql2` + Drizzle run on the **Node.js** runtime; not Edge-compatible as configured — the app must keep DB access on Node functions. |
| Driver compatibility | `mysql2` connection-string pool (`DATABASE_URL`), `mode: "default"`, `dateStrings: true`, per-connection `SET time_zone = '+00:00'`. |
| Connection pooling | One pool per process, cached on `globalThis`, created lazily; `connectionLimit: 10`, `maxIdle: 10`, `idleTimeout: 60 s`, `waitForConnections: true`. |
| Serverless connection limits | Vercel runs backends as **serverless functions**: the pool is **per instance**, not global, so total connections ≈ instances × 10. Vercel publishes an official connection-pooling guide (`https://vercel.com/kb/guide/connection-pooling-with-functions`). |
| Connection lifecycle | Now explicit: `sharedConnection()` (runtime, no-op dispose) vs `isolatedConnection(url)` (owned, disposable). `closeDb()` remains for graceful shutdown/tests. |
| Environment variables (names only) | `DATABASE_URL` (required). `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` must become **optional / archived-tooling-only** after P0E-1B. `MIGRATION_SNAPSHOT_AT` optional (archived tooling). Values are never printed. |
| Managed vs external DB | **No managed MySQL/MariaDB service exists in the available service catalog**, so the provider is an owner decision. |
| Networking constraints | The chosen host must be reachable from Vercel functions; TLS and IP/allow-list configuration may be required. |
| Production rollout risks | Pool exhaustion under concurrency; cold-start latency; provider SSL/TLS mismatch; missing serverless-friendly pooling. |
| Owner decisions still required | **D-CONN-1** — database provider; **D-CONN-2** — connection strategy (conservative `mysql2` limits vs a pooler/HTTP driver vs both). |

No environment value was printed, no infrastructure purchased, no provider
selected, no Vercel setting modified, and no deployment performed.

### C12. Tests before and after

| | Files | Tests | Changed by this phase |
| --- | --- | --- | --- |
| Before P0E-1A | 7 | **214 / 214** | — |
| After P0E-1A | 8 | **221 / 221** | **+7 new** (`tests/application-foundation.test.ts`) |

Per file after: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` 46 ·
`migration-snapshot` 39 · **`application-foundation` 7**. Exit code **0**.
**No test was skipped, deleted, weakened, or had its assertions relaxed.**

### C13. TypeScript / lint / db:check / build results

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | **0 errors** | **0** |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`src/app/actions/job-actions.ts:8` unused `Job`, untouched file) | **0** |
| `npm run db:check` | `Everything's fine 🐶🔥` (schema ⟷ journal consistent) | **0** |
| `npm run migration:preflight` | read-only production preflight, no drift (C10) | **0** |
| `npx vitest run` | **221 passed / 221** (8 files) | **0** |
| `npm run build` | compile ✓, TypeScript ✓, then **static prerender fails** | **1** |

Internal note: the first `tsc` runs in this environment were slow under memory
pressure, so a stale `tsconfig.tsbuildinfo` (gitignored) was removed and the check
re-run; the final `tsc --noEmit` exited 0 with no output.

**Build failure — inherited blocker, carried forward to P0E-1B:** the Google
Sheets prerender dependency (C9). Recorded separately; **not** marked PASS; no
fake credentials or suppression added.

### C14. Production / source data safety proof

- **MySQL:** production was touched **only** by `npm run migration:preflight`
  (SELECT / `information_schema`; `assertReadOnlyQuery` rejects DDL/DML keywords;
  the run refuses any database other than `database-airprod`). No DDL, DML, seed,
  migrate, truncate, drop, reset, or overwrite. All 14 tables remain at **0 rows**;
  journal remains `0000`; `job_id` remains NOT NULL; idempotency columns remain
  absent; no drift. **`airprod_test` was never used as a production database**, and
  the preflight guard rejects it.
- **Google Sheets:** **no access of any kind** — no read, write, format, or delete,
  and no credential was requested. Archived migration tooling was not executed
  against the real spreadsheet.
- **Repository:** `getRepositories()`, all Google Sheets code, all pages/layouts/
  Server Actions, the legacy services, every schema file, every migration file,
  `package.json`, and every existing test file are **unchanged**. The only source
  edit is the `createDatabaseHandle` export in `src/db/index.ts` (behaviour
  identical). Nothing was committed, pushed, or deployed; HEAD is still `7c4cc41`.
- No Google Sheets data, migration tooling, or document was deleted.

### C15. P0E-1B implementation plan (ordered)

See **Section F** for the full handoff. Summary order:
1. Remove the layout/route build-time data read so `next build` can succeed without Google credentials.
2. Introduce the MySQL provider at the single `getRepositories()` seam using the P0E-1A foundation.
3. Rebuild the master-data path (clients, vendors, crew + `crewRoles`) on canonical services.
4. Convert jobs + job detail to canonical services; deliver crew-role selection and derived payment status.
5. Convert finance off `expenses`/stored status to schedules + cashflows + derived status.
6. Remove venue from the active UI and navigation.
7. Convert the remaining Server Actions; delete the direct `@/repositories` barrel import.
8. Delete/replace the legacy services and `@/services/types` view models.
9. Apply `0001` to `airprod_test` only; re-verify; rehearse rollback.
10. Full verification incl. a build with no Google credentials present.

### C16. Outstanding blockers and owner decisions

Current-phase blockers: **none blocking P0E-1A** (it is complete). Carried to later
phases: build still needs Google credentials; runtime still Google Sheets;
`0001` unapplied; 17 blocked legacy methods; UI/feature gaps; auth and job-number
generation absent; Vercel provider undecided. Full register: **Section E**.

### C17. Overall roadmap progress

**5 / 18 = 27.8 %** historical completion (**unchanged**); **1** skipped (P0D);
**12** remaining; adjusted active-roadmap **5 / 17 = 29.4 %** (**not** a gain);
production readiness **3 / 10** (**unchanged**). **P0E remains IN PROGRESS**; the
next subphase is **P0E-1B, NOT STARTED**.

### C18. Final verdict

**PASS WITH LIMITATIONS.** The canonical MySQL application composition foundation
is implemented, isolated, and verified (221/221 tests, tsc 0, lint 0 errors,
`db:check` clean), the consumer inventory and blocked-method count are
code-grounded (17, correcting a stale "19"), empty-database behaviour is verified,
and `0001`/Vercel prerequisites are documented. The limitation is the pre-existing
build failure (Google Sheets prerender dependency), which is the P0E-1B acceptance
criterion. **No runtime switch, no production change, no `0001` rollout, no
commit/push/deploy.**

---

## SECTION D — HISTORICAL PHASE LOG

| Date | Event |
| --- | --- |
| 2026-10-14 | Tracker created during P0C-3. The file did not exist before, so no earlier tracker history had to be preserved; prior phase history lives in the phase reports linked below. P0A–P0C-3 recorded as PASS WITH LIMITATIONS (5/18, 27.8%). P0D onward remain PENDING. Production readiness recorded separately (3/10). |
| 2026-10-14 | **P0D-1** added as a subphase of P0D and recorded **PASS WITH LIMITATIONS**: migration mapping spec + validators, deterministic identity/idempotency, venue archive, proposed (unapproved) crew-role dictionary, financial reconciliation rules, decimal-safe totals, read-only dry-run planner, 45 new tests (174/174 total), 4 new documents. P0D parent remains **IN PROGRESS**; master progress unchanged at **5/18 (27.8%)**; production readiness unchanged at **3/10**. Source data checks BLOCKED (no `GOOGLE_SHEETS_ID`); reconciliation decisions D1–D12 open; migration `0001` still not applied to production; nothing committed or pushed. |
| 2026-10-14 | **P0D-2A** recorded **BLOCKED ON SOURCE ACCESS**. Delivered: read-only fail-closed source adapter + reproducible snapshot process (header/schema/row/snapshot fingerprints, change detection, PII-sanitised reports), the **corrected financial duplicate rule** (equal amount is only `POTENTIAL_DUPLICATE`; only `PROVEN_DUPLICATE` may be skipped), the D1–D12 decision register with strict approval gating, fixed-snapshot dry-run tooling, and a read-only production MySQL preflight (`npm run migration:preflight`: 14 tables all at 0 rows, journal = `0000`, `job_id` still NOT NULL, no idempotency columns/UNIQUE, no drift). Tests 174 → **214/214**; no test skipped or weakened (assertions in 3 tests encoding the superseded equal-amount rule were updated; disclosed in the phase report §15). P0D parent remains **IN PROGRESS**; master progress unchanged at **5/18 (27.8%)**; production readiness unchanged at **3/10**. Migration `0001` still not applied; P0D-2B **NOT STARTED** and approval-gated; nothing committed or pushed. |
| 2026-10-14 | **P0D-CLOSE** recorded **PASS** (documentation + read-only verification only). Owner decision **OPTION A — FRESH START MYSQL** recorded as authoritative: historical Google Sheets import abandoned as a requirement; MySQL/MariaDB is the sole intended runtime database. **P0D parent marked SKIPPED — OWNER DECISION**; **P0D-2B CANCELLED / NOT REQUIRED**; P0D-1 and P0D-2A historical results preserved unchanged (PASS WITH LIMITATIONS / BLOCKED ON SOURCE ACCESS). Original 18-milestone roadmap retained for traceability; **historical completion unchanged at 5/18 (27.8%)** with 1 skipped and 12 remaining; adjusted active-roadmap metric defined explicitly as **5/17 (29.4%)** on the reduced denominator (**not** a progress gain). **Production readiness unchanged at 3/10.** Read-only preflight re-verified: 14 tables, all 0 rows, journal = `0000`, `job_id` NOT NULL, no idempotency columns/UNIQUE, no drift. Checks: `tsc` 0 errors · `lint` 0 errors (1 pre-existing warning) · `db:check` clean · **214/214 tests** · `npm run build` still fails at prerender (inherited Google Sheets credential dependency, assigned to P0E-1). `0001` still not applied; runtime still Google Sheets; no destructive action; nothing committed or pushed. Next: **P0E-1, NOT STARTED, approval-gated** (`docs/FRESH-START-MYSQL-PLAN.md`). |
| 2026-10-14 | **P0E-1A** recorded **PASS WITH LIMITATIONS**. Implemented the application-level canonical MySQL composition foundation: new `src/db/connection.ts` (`sharedConnection()` reuses the single runtime `getDb()` pool; `isolatedConnection(url)` is lazy, owned, idempotently disposable) and new `src/services/application.ts` (`createApplicationBackend({ connection? })` composing the existing `createMySqlApplication()` — no competing abstraction, no Google fallback, no connection at import), plus a minimal refactor exporting `createDatabaseHandle(url)` from `src/db/index.ts` (behaviour identical). Added `tests/application-foundation.test.ts` (**+7 tests → 221/221**). Built the code-grounded legacy consumer inventory (26 entries) and **corrected the blocked-method count from a stale 19 to the actual 17**; verified Contract v2 coverage (12/12 members, 59 methods); verified empty-database compatibility; confirmed the inherited build chain (`src/app/layout.tsx` → `master-service` → Google client → missing `GOOGLE_SHEETS_ID`, now failing even on `/_not-found`) and produced the ordered P0E-1B plan; documented `0001` prerequisites and Vercel/MySQL connectivity analysis. Checks: `tsc` 0 · `lint` 0 errors (1 pre-existing warning) · `db:check` clean · **221/221 tests** (exit 0) · **`npm run build` exit 1** (inherited, carried to P0E-1B). Production untouched (preflight exit 0: 14 tables all 0 rows, journal `0000`, `job_id` NOT NULL, no idempotency columns/UNIQUE, no drift); **runtime still Google Sheets**; `getRepositories()` unchanged; `0001` not applied; no commit/push/deploy. Historical completion **5/18 (27.8%)** and production readiness **3/10** unchanged; **P0E IN PROGRESS**; next is **P0E-1B, NOT STARTED, approval-gated**. |
| 2026-10-14 | **P0E-1B** recorded **PASS**. Converted the active application consumers to canonical MySQL Contract v2 behind **one** composition boundary (`src/services/runtime.ts` → `createApplicationBackend()`): `master-service`, `job-service`, `dashboard-service`, `src/services/types.ts`, `src/lib/labels.ts`, `src/lib/utils.ts`, the 4 Server Action modules, the 7 data routes, the root layout, the sidebar/nav and the jobs/master/finance components. **Deleted** the legacy runtime seam `src/repositories/index.ts` and the legacy **Venue** route `src/app/venues/page.tsx`; navigation and job forms no longer expose Venue (only `jobs.legacy_venue_name` as a free-text historical snapshot). Root layout is now I/O-free; every data page is `export const dynamic = "force-dynamic"`. **Build fixed:** `npm run build` = **exit 0 with no `GOOGLE_*` credential present** (previously exit 1 at prerender) — `/` and `/_not-found` static, all 7 data routes dynamic, no `/venues`. Added `tests/application-conversion.test.ts` (**+14 tests → 235/235**), which exercises the real service layer against `airprod_test` and statically enforces: no active Google/legacy-contract import in `src/app`+`src/services`, no `getRepositories`, layout free of data reads, every data page dynamic, and venue gone (no route/dir, no nav entry, no `venueId`/`createVenue`/`getVenues`). Verified migration `0001` on **`airprod_test` only** (`cashflows.job_id` nullable, `idempotency_key`/`idempotency_fingerprint` present, `uq_cashflows_idempotency_key` UNIQUE) and canonical financial invariants: obligation ≠ cash, derived status, DB-backed idempotency (identical replay returns the same row; same key + different payload → `RepositoryConflictError`), general expense with `job_id = NULL`. Checks: `tsc` 0 · `lint` **0 errors, 0 warnings** · `db:check` clean · **235/235** · **build exit 0** · `migration:preflight` exit 0. Production untouched (preflight exit 0: 14 tables all 0 rows, journal `0000`, `job_id` NOT NULL, no idempotency columns/UNIQUE, no drift); **`0001` not applied to production**; production DB not activated; no production write; no Google access; no commit/push/deploy. Milestones unchanged at **5/18 (27.8 %)** / skipped 1 / remaining 12 / adjusted **5/17 (29.4 %)**; production readiness **3/10 → 4/10** (build-green criterion now evidenced). **P0E IN PROGRESS**; next is **P0E-2, NOT STARTED, approval-gated**. |
| 2026-10-14 | **P0E-2A** recorded **PASS WITH LIMITATIONS**. Audited the migration runner (`drizzle-kit migrate` for production, `drizzle-orm` migrator in tests), `0000`/`0001`, Drizzle journal handling, the lazy `mysql2` pool lifecycle, the fail-closed test-DB guards, and `docs/MIGRATION-RUNBOOK.md` Part A. Added pure fail-closed guards (`src/migration-cli/activation-guards.ts`) that make it structurally impossible for the rehearsal to back up anything but production or to write/drop anything but the disposable `airprod_rehearsal`. Added `scripts/p0e2a-rehearsal.mjs` (+ `npm run migration:rehearsal`) and protected the artifact directory by adding `.migration-backups/` to `.gitignore`. **Executed the rehearsal end-to-end: 26/26 checks passed** — read-only logical dump of `database-airprod` (MariaDB 11.8.8, 14 tables, all 0 rows) with recorded sha256 `c0f4b6ed2f93…` (18 708 bytes, mode 0600, git-ignored location), restore into `airprod_rehearsal` with an identical schema fingerprint and identical journal/row counts, `0001` applied through the real Drizzle migrator (nullable `cashflows.job_id`, both idempotency columns, `uq_cashflows_idempotency_key` UNIQUE, FK `cashflows.job_id → jobs.id` intact, journal 1→2 with hashes equal to `airprod_test`, defaults normalised to `0.00`, zero domain-row change), idempotent migrator re-run, a raw re-apply that **fails loudly** (`ER_DUP_FIELDNAME`) leaving the schema unchanged, and canonical financial operations on the migrated schema (idempotent replay returns the same cashflow, derived `PARTIAL` status, jobless general expense with `job_id NULL`). The disposable database was dropped afterwards; `airprod_test` was never used as a rehearsal target. **BLOCKED:** an off-server backup copy cannot be created or verified here, so the runbook's “stored outside the app host” requirement stays unmet. `npm run migration:preflight` (exit 0) re-confirmed production is unchanged: 14 tables all 0 rows, journal `0000`, `job_id` NOT NULL, no idempotency columns/UNIQUE, no drift, and `0001` was **not** applied. Checks: `tsc` 0 · `lint` 0 errors 0 warnings · `db:check` clean · **250/250 tests** (10 files; +15 new guard/migration tests) · **build exit 0 with no `GOOGLE_*`** · preflight exit 0. Corrected a documentation error: the service catalog **does** list MySQL-compatible managed options (PlanetScale, Aiven), so the earlier “no managed MySQL exists” statement was inaccurate (Section H.7). Milestones unchanged at **5/18 (27.8 %)** / skipped 1 / remaining 12 / adjusted **5/17 (29.4 %)**; **production readiness stays 4/10** (a plan is not a satisfied criterion). No commit/push/deploy. **P0E IN PROGRESS**; next is **P0E-2B, NOT STARTED, approval-gated**. |
| 2026-10-14 | **P0E-2A.1** recorded **PASS WITH LIMITATIONS**. Hardened the activation gate: added pure fail-closed guards (`classifyHost`/`classifyHostFromUrl`, `evaluateOffHostEvidence`+`assertOffHostConfirmed`, `checksumsMatch`/`assertChecksumsMatch`, `isSafeArtifactName`/`assertArtifactPathInsideBackupDir`, `validateBackupManifest`, `validateActivationApprovals`, `findSecretLeaks`/`assertNoSecretLeak`, `deriveBackupAcceptanceState`) and a new fail-closed **activation readiness checklist** (`src/migration-cli/activation-checklist.ts`, 21 `P0E2B-*` items) that also closes the P0D-named-checklist gap (B-17). Added a guarded **local-PC backup preparation + destination-verification workflow** (`scripts/p0e2a1-local-backup.mjs`; `npm run migration:backup:local prepare|verify`): reuses the P0E-2A guard module, records a JSON manifest (sha256/bytes/mode/git-ignore), prints safe operator transfer instructions, and re-verifies the checksum at the destination — refusing mismatches and any non-`--separate-machine` attestation. **Topology inspected (no private IP/user/password/connection string printed):** the production DB host classifies as **LOOPBACK — the same machine** as the project workspace, and the owner selected the **local laptop/PC** as the backup destination. Per the phase rule this destination is therefore **NOT OFF-HOST**; the off-host acceptance process is **STOPPED**, the four backup conditions are reported separately, and no storage provider was silently substituted. Re-ran the existing rehearsal: **26/26 checks**, exit 0, no artifact overwritten. Checks: `tsc` 0 · `lint` 0 errors 0 warnings · `db:check` clean · **272/272 tests** (11 files; +22 new, none weakened) · **build exit 0 with no `GOOGLE_*`** · `migration:preflight` exit 0. Least-privilege review (runtime is DML-only; separate migration/backup/restore roles documented) and the D-CONN-1/D-CONN-2 provider/pooling inventory (Aiven, PlanetScale listed — no provider selected/purchased) added. Production untouched; `0001` still unapplied; no commit/push/deploy. Milestones unchanged **5/18 (27.8%)** / skipped 1 / remaining 12 / adjusted **5/17 (29.4%)**; production readiness **stays 4/10**. **P0E IN PROGRESS**; next is **P0E-2B, NOT STARTED, approval-gated**. |
| 2026-10-14 | **P0E-DEV-1** recorded **PASS** (local application runtime stabilization). Created the **dedicated local development database `airprod_dev`** (did **not** exist before; `database-airprod` and `airprod_test` untouched) and applied the existing Drizzle migrations `0000` + `0001` to it only (journal = 2). Re-pointed the application's `.env` `DATABASE_URL` to `airprod_dev` while preserving the original production URL as a **commented, disabled** line; test tooling still derives `airprod_test`. Fixed the test guard (`tests/helpers/db.ts`) so `npm run test` no longer STOPS when the app is on `airprod_dev` (now accepts the dev **or** production base, always derives `airprod_test`, still rejects unknown bases and never targets production). Fixed a real local-dev runtime defect in `next.config.ts`: Next 16 blocked dev resources (font `__nextjs_font/*` → 403, HMR WebSocket handshake failure, and in the preview browser incomplete hydration) when the app was opened via `http://127.0.0.1:<port>` because the dev server's origin is `localhost` — added `allowedDevOrigins: ["localhost", "127.0.0.1"]` and verified both origins now serve the font (200) and hydrate. Ran the app (`next dev`, port 3001) against `airprod_dev` and performed **real browser E2E**: all 6 dynamic routes + `/` + 404, then created a client, a vendor, a crew role, a crew, a job (manual number `JOB-001`), a crew assignment (obligation Rp 750.000) and its cash payment (derived status `Sudah Dibayar`), a delivery, a client schedule (Rp 5.000.000) with a partial payment (derived status `Sebagian`), a vendor schedule (Rp 400.000), a job-attached expense (Rp 250.000) and a **jobless** expense (Rp 100.000, `job_id = NULL`) — all through the real Server Action boundary; duplicate job number correctly rejected in-modal (error path). Added `tests/local-dev-runtime.test.ts` (**+6 tests → 278/278**, 12 files). Checks: `tsc` **0** · `lint` **0 errors, 0 warnings** · `db:check` clean · **278/278** · **build exit 0 with no `GOOGLE_*`**. Safety: `airprod_dev` holds the dev data; `airprod_test` and `database-airprod` show **0 data rows** (prod journal still `0000` only). No commit/push/deploy; no production migration/deployment; no Google access. Milestones unchanged **5/18 (27.8%)** / skipped 1 / remaining 12 / adjusted **5/17 (29.4%)**; production readiness **stays 4/10** (local runtime success ≠ production readiness). **P0E IN PROGRESS**; next is **P0E-2B, NOT STARTED, approval-gated**. |

---

## SECTION E — BLOCKERS AND OWNER DECISIONS

### E1. Blockers for the PREVIOUS phase (P0E-2A, historical)

**One criterion is BLOCKED, not one defect.** P0E-2A completed every mandatory scope
item, but the runbook's requirement that the backup live **outside the app host**
(`docs/MIGRATION-RUNBOOK.md` A.3) cannot be satisfied or verified from this
environment — no off-host destination exists and none was authorized (Section H.5,
check **P0E2A-B1**). The rehearsal itself (backup → restore → `0001` → verification →
repeat-safety) **did** execute and pass 26/26 checks on a disposable database.
Nothing about the application, schema or migration is blocked.

### E1b. Blockers/clients closed by P0E-1B

| Closed | Was | Closed by |
| --- | --- | --- |
| B-1 | Active runtime still Google Sheets | All consumers read/write canonical services through `src/services/runtime.ts`; the legacy `getRepositories()` barrel was deleted |
| B-2 | Inherited build failure at prerender | Root layout no longer reads data; data routes are `force-dynamic`; `npm run build` = exit 0 with no `GOOGLE_*` set |
| B-3 | Legacy consumer conversion pending (26-entry inventory) | Every inventory entry converted or removed (Section G.5); no fake adapter introduced |
| B-4 | 17 blocked legacy-adapter methods | The legacy adapter left the runtime path altogether; canonical operations are used directly — no stub, no resurrected Venue/Expense/stored-status concept |
| B-10 (venue) | Venue still in the active UI | `/venues` route and navigation entry removed; venue pickers deleted from job forms |
| B-10 (expense) | Legacy expenses table in the finance UI | General expenses recorded as canonical cashflows, job optional |
| B-10 (status) | Stored payment status shown as truth | Payment status derived from actual cashflows everywhere |

### E1c. Blockers for the CURRENT phase (P0E-2A.1)

**One criterion is BLOCKED, and it is now a hard STOP.** P0E-2A.1 completed every
safely executable scope item. The owner selected the **local laptop/PC** as the backup
destination, but the topology inspection shows the **production database host is the
same machine** (`LOOPBACK` — see Section I.3). Per the phase rule, that destination is
classified **NOT OFF-HOST**, the off-host acceptance process is **STOPPED**, and no
storage provider was silently substituted. The four backup/storage conditions
(local backup created · transferred · destination checksum verified · off-host restore
rehearsed) are reported **separately** (Section I.5), and a resume requires a **new
owner decision naming a genuinely separate destination**. The activation gate was
hardened in the meantime, so no future phase can silently treat the same-machine
destination as off-host. Nothing about the application, schema or migration is
blocked.

### E1d. Blockers for the CURRENT phase (P0E-DEV-1)

**No blocker prevented this phase from passing.** The application runs locally against
the dedicated development database; every active route and every implemented workflow
was exercised. The one genuine local runtime defect found (Next 16 blocking
dev resources for the `127.0.0.1` origin) was reproduced, root-caused and fixed, and is
covered by a regression test. Residual **limitations** (not blockers):

- **Authentication is still absent (P1A/P1B).** The local application must only run in
a **private** development environment — no tunnel, no public exposure, no deploy. The
shell's static “Admin” label is **not** authentication.
- **`jobNumber` is still manual (P2A).** Creating a job requires an explicit unique
number; automatic generation is unimplemented (correctly rejected duplicates prove the
UNIQUE constraint is enforced).
- **No schedule `delete`** exists in the canonical contract, so the finance UI offers
create+update only (documented, not hidden).
- **`airprod_test` is shared and reset on every `vitest` run** — it is not a durable
environment; `airprod_dev` is the durable local development database.
- **Browser E2E ran against the dev server**, not a production build; and the
`migration:preflight`/`rehearsal` production gates from P0E-2A/2A.1 remain untouched
(P0E-2B is still blocked on off-host backup, window/operator/rollback owner and
written approval — Section E1c/E2).

### E2. Blockers for LATER phases

| # | Blocker / decision | Impact | Needed from owner | Target phase |
| --- | --- | --- | --- | --- |
| B-1 | ~~Active runtime still Google Sheets (`getRepositories()`)~~ — **CLOSED by P0E-1B** | — | — | closed |
| B-2 | ~~Inherited build failure (Google credential prerender)~~ — **CLOSED by P0E-1B** (`npm run build` exit 0) | — | — | closed |
| B-3 | ~~Application consumer conversion (26 consumers)~~ — **CLOSED by P0E-1B** (Section G.5) | — | — | closed |
| B-4 | ~~17 legacy-adapter blocked methods~~ — **CLOSED by P0E-1B** (the legacy adapter left the runtime path; canonical operations used directly, no stub) | — | — | closed |
| B-5 | **`0001` not applied to production** — gate now *specified and rehearsed*, still unapproved | Canonical cashflow/expense writes fail on production; jobless expenses impossible | **Written go/no-go** naming window, operator, backup location + checksum, rollback owner | P0E-2B |
| B-6 | **Production database activation not approved** | Production still empty/unused by the app; the converted runtime is unverified in a deployed environment | Explicit activation gate (**separate** decision from the `0001` rollout) | P0E-2B |
| B-7 | **Database provider/connection strategy undecided** (D-CONN-1 provider; D-CONN-2 pooling) — options now enumerated with real candidates (Section H.7) | Deployment target unknown; serverless pool-exhaustion risk | Provider + connection-strategy decision | P0E-2B (decide) / P4A (implement) |
| B-14 | **Backup destination NOT OFF-HOST** — owner chose the local laptop/PC, which is the **same machine** as the DB host (P0E-2A.1 topology: `LOOPBACK`); off-host acceptance **STOPPED** | Recovery on host/disk loss is unproven; the runbook A.3 requirement is unmet and cannot be met on the current machine | **Separate destination decision** (a genuinely separate machine/device) plus owner-run transfer + checksum verification; do **not** substitute a provider silently | P0E-2B (mandatory entry requirement) |
| B-15 | **Rehearsal ran against an empty production clone** (0 rows in all 14 tables) | Schema, journal, guard and idempotency behaviour are proven; **data-volume behaviour is not** — the `ALTER TABLE … MODIFY` on `cashflows`/`crew`/`job_crews` may rebuild tables and take locks proportional to row count | Either accept an empty-table rollout with a measured window, or rehearse against a populated copy | P0E-2B |
| B-16 | **Maintenance window, operator and rollback owner unassigned** | The gate cannot be executed responsibly without them | Name window + operator + rollback owner | P0E-2B |
| B-17 | ~~Preflight checklist still P0D-named and blind to rehearsal evidence~~ — **ADDRESSED in P0E-2A.1**: new fail-closed activation checklist `buildActivationReadinessChecklist` (21 `P0E2B-*` items) covers identity, journal, drift, backup, off-host evidence, sha256, restore, window, operator, rollback owner, separate approvals, runtime permissions and public-exposure restriction. The legacy `buildP0D2BReadinessChecklist` is retained for historical tooling. | Operators now get a gate that **fails closed** when evidence is absent | — | closed |
| B-8 | **Authentication/authorization not implemented** (P1A/P1B) | No login; `admins`/`sessions` are display-only; the shell's static “Admin” label is a placeholder, **not** authorization | — (planned) | P1A/P1B |
| B-9 | **Automatic job numbering not implemented** (P2A) | Canonical `jobs.create` still needs an explicit unique `jobNumber` (manual entry, UNIQUE-enforced) | — (planned) | P2A |
| B-10 | **Remaining business UI gaps** — deeper crew UX, dashboard/delivery depth, client/vendor form polish; the canonical contract has **no schedule delete** so the finance UI exposes create+update only | UI/feature incomplete on the canonical model | — (planned feature changes, never fake adapters) | P2B → P2E |
| B-11 | **No milestone-count increase** from P0E-1B (still 5/18 · 5/17) | P0E is not complete; only the build-green readiness criterion moved (3/10 → 4/10) | — (informational) | — |
| B-12 | **Uncommitted delta** — pre-existing `dotenv` addition in `package.json`/`package-lock.json`, plus all P0A→P0E-2A work (89 paths carried in from P0E-1B, 90 in total after P0E-2A) | Review before committing | Owner review (not a blocker to progress) | whenever the owner commits |
| B-13 | **Converted runtime not exercised in a deployed environment** (no auth, no admin data) | Source conversion is proven by tests + build, not by a live deployment | — (P0E-2B activation / P1A) | P0E-2B / P1A |
| B-18 | **No application-level least-privilege DB account** — one `DATABASE_URL` holds the full account privileges used for DDL, dumps and app access | A leaked app credential could drop/alter schemas; no separation between migration and runtime roles | Decide whether P0E-2B introduces a separate migration user vs. an app user with DML-only rights | P0E-2B |

---

## SECTION F — PHASE HANDOFF (HISTORICAL: P0E-1B; NEXT: P0E-2)

**Status of this handoff: EXECUTED IN P0E-1B.** The plan below is preserved as the
approved plan that was carried out; its results, deviations, and evidence are in
**Section G**. The **current** next-phase handoff (P0E-2) is **F9** at the end of
this section, and Section G.22–G.23.

### F1. Exact scope (in)

Wire the application to the canonical MySQL backend through the single
`getRepositories()`/service seam created in P0E-1A, and resolve every legacy
incompatibility by **planned feature changes** (never fake adapters):

1. **Build safety:** remove the build-time Google Sheets read (root layout →
   `getCurrentAdmin`) and make the 8 data routes build-safe (dynamic rendering
   and/or a credential-free shell) so `npm run build` **exits 0 with no Google
   credentials present**.
2. **Provider seam:** make the runtime repository provider MySQL-backed **behind a
   single seam**, using `createApplicationBackend` from P0E-1A; the Google
   implementations stay in the repo but leave the runtime path.
3. **Master data:** convert `master-service` consumers to `services.master`
   (clients, vendors, crew) and add `crew_roles` selection/creation.
4. **Jobs:** convert `job-service` list/detail/CRUD to `services.jobs`; keep
   **explicit manual `jobNumber`** validated against the canonical UNIQUE
   constraint (generation stays P2A); drop venue from the job form.
5. **Finance:** convert to `financial` schedules + cashflows; show **derived**
   status; general expenses via `financial.recordGeneralExpense`.
6. **Venue removal:** remove `/venues` and venue pickers from the active UI/nav;
   `jobs.legacyVenueName` holds free text only.
7. **Actions:** convert `master-actions`, `job-actions`, `job-detail-actions`,
   `finance-actions`; remove the direct `@/repositories` barrel import.
8. **Legacy cleanup:** rebuild or delete `master-service`, `job-service`,
   `dashboard-service`, `src/services/types.ts`, and the legacy finance CRUD path —
   no dual implementations left.
9. **`0001` on test DB only:** apply to `airprod_test`, re-verify, rehearse rollback.
10. **Env contract:** document names only (`DATABASE_URL`; Google vars become
    optional/archived-tooling-only) — `.env.example` updated without secrets.

### F2. Entry prerequisites

- Owner approval for P0E-1B (this handoff names it explicitly).
- P0E-1A foundation present (✓) and 221/221 tests green (✓).
- Decision (or explicit deferral) on B-7 provider/connection strategy.
- Confirmation that no production `0001` rollout or runtime activation is
  authorised inside P0E-1B.

### F3. Consumer conversion order (recommended)

1. **Shell/build safety** (layout + route rendering) — unblocks a credential-free build.
2. **Provider seam** (canonical backend behind `getRepositories()`), verified on `airprod_test`.
3. **Master data** (clients → vendors → crew/crewRoles).
4. **Jobs list & detail** (canonical jobs + counterparty; derived status).
5. **Crew assignment** (`jobCrewAssignments`, `crew_roles`, no `paymentStatus` field).
6. **Deliveries** (`services.deliveries`).
7. **Finance** (schedules + cashflows + derived status; general expenses).
8. **Venue removal** (route, nav, job forms).
9. **Server Actions** conversion + removal of the direct repositories import.
10. **Legacy service deletion/rebuild** and view-model cleanup.
11. **`0001` on `airprod_test`** + rollback rehearsal.
12. **Full test/build acceptance** (below).

### F4. Required tests

- Canonical-path coverage for every rewired route/action (list, detail, create,
  update, delete; derived status; crew-role selection; general expense).
- Regression tests for the removed venue/expense/stored-status behaviours
  (venue absent from nav and forms; expenses recorded as cashflows; status derived).
- Keep all **221** existing tests green; **no test deleted, skipped, or weakened**.
- A build test that runs `npm run build` with Google credentials absent.

### F5. Build acceptance criteria

- `npm run build` exits **0 without** `GOOGLE_SHEETS_ID` / `..._EMAIL` /
  `..._PRIVATE_KEY` present.
- `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm run db:check` clean ·
  full test suite green (≥221, none weakened).
- No application page, action, or service imports a Google Sheets module; no page
  or action imports a concrete provider outside the single seam.

### F6. Safety constraints

- `.gitignore`-safe: no commit/push/deploy in P0E-1B unless separately approved.
- **No `0001` on `database-airprod`**, no seed/reset/truncate/drop, no production writes.
- `airprod_test` only for migration/tests; `airprod_test` never used as production.
- No Google Sheets reads/writes; no credential requests; no Google code deletion.
- No fake adapters, mock credentials, or error suppression to make checks pass.

### F7. Carried-forward blockers

B-1 (runtime), B-2 (build), B-3 (consumers), B-4 (17 blocked methods), B-7
(provider strategy), B-11 (readiness 3/10), B-12 (uncommitted delta). B-5/B-6
(`0001` rollout, production activation) remain behind the **P0E-2** gate; B-8/B-9/B-10
stay in P1A/P1B/P2A and later UI phases.

### F8. Explicit approval gates

1. **Now:** owner approval to start P0E-1B (this handoff).
2. **Before P0E-1B finishes:** owner decision on the database provider /
   Vercel connection strategy (or an explicit deferral to P4A).
3. **Separately, later:** written approval for the `0001` production rollout and
   runtime activation (**P0E-2**), naming window, operator, backup location, and go/no-go.

### F9. UPDATED NEXT-PHASE HANDOFF — P0E-2 PRODUCTION ACTIVATION GATE (PLANNING ONLY)

**Status: NOT STARTED. Not approved. Not executed.** P0E-1B authorisation does **not**
carry into P0E-2. Production migration approval, production runtime activation, and
**deployment** are **three separate owner decisions**.

**Entry requirements (all mandatory before P0E-2 may begin)**

1. `npm run build` exits 0 with `GOOGLE_*` absent. — ✅ **already met by P0E-1B**.
2. Full suite green (235/235) and `tsc`/`lint`/`db:check` clean. — ✅ **already met**.
3. Migration `0001` verified on `airprod_test` (schema + UNIQUE + nullable `job_id`). — ✅ **already met** (Section G.14).
4. A written owner **go/no-go** naming the maintenance window, operator, backup location, and rollback owner. — ❌ **not requested**.
5. Candidate dump taken with a recorded checksum and stored **outside** the server. — ❌ **not taken**.
6. Restore rehearsal: the dump restored into a throwaway database and row counts/schema compared. — ❌ **not rehearsed**.
7. `npm run db:check` clean and `migration:preflight` read-only baseline re-confirmed immediately before the window. — ✅ baseline currently clean.
8. D-CONN-1 (provider) and D-CONN-2 (pooling strategy) decided, or explicitly deferred to P4A with the runtime kept on conservative `mysql2` limits. — ❌ **open**.

**Production `0001` rollout plan (test first, then production)**

1. Backup `database-airprod` (logical dump, checksum recorded, stored off-server).
2. Restore-rehearse that dump into a throwaway database and diff schema + row counts.
3. Apply `0001` to **`airprod_test`** first; re-verify with the Section G.14 probes.
4. Stop the application (or put it in maintenance mode) so no writes race the DDL.
5. Apply `0001` to `database-airprod` (additive: `cashflows.job_id` → NULL, two
   `NOT NULL DEFAULT '0.00'` columns, add `idempotency_key`/`idempotency_fingerprint`,
   add `uq_cashflows_idempotency_key`).
6. Re-run `db:check` + `migration:preflight`; confirm journal moves `0000` → `0001`.
7. **Rollback:** `0001` has **no down-migration**; rollback = restore the pre-migration
   dump (and, if the provider switch is implicated, revert the single composition
   boundary `src/services/runtime.ts`).

**Runtime activation (separate decision, after `0001`)**

1. Point the target environment's `DATABASE_URL` at the intended production database.
2. Deploy/preview the converted build; confirm all 7 data routes render the empty state.
3. Post-activation smoke tests (read-only first): dashboard, jobs list, job detail,
   clients/vendors/crew, finance ledger — all must render empty/normal, never fabricated.
4. First write-path smoke test only after explicit approval, using a disposable record,
   then confirm derived status and idempotency behaviour.
5. Confirm `GOOGLE_*` remain **optional/archived-tooling-only** and are never required.

**Production-write safeguards / constraints**

- No seed script, sample data, or fake admin may be inserted to make the UI look populated.
- No weakening of financial invariants (decimal strings, atomic writes, DB idempotency, derived status).
- No migration executed through the app runtime; migrations remain an operator action.
- Google Sheets stays readable as an archived reference only; it is never a fallback.

**Known limitations to carry into P0E-2 (not blockers to the DDL itself)**

- Authentication/authorization (P1A/P1B) absent: the shell's “Admin” label is not security.
- No automatic job numbering (P2A): `jobNumber` remains manual and UNIQUE-enforced.
- Deployment (P4A/P4B) is a **separate** gate again — activation ≠ deployment.

---

## REFERENCE APPENDIX

### R1. Production Database Status (unchanged, re-verified read-only)

| Aspect | Status |
| --- | --- |
| Database | `database-airprod` |
| Tables | **14** — `admins, cashflows, clients, client_payments, crew, crew_roles, deliveries, jobs, job_crews, job_sequences, sessions, vendors, vendor_payments, __drizzle_migrations` |
| `cashflows.job_id` | still **NOT NULL** (`0001` not applied) |
| Idempotency columns / UNIQUE on `cashflows` | **absent** (`0001` not applied) |
| Row counts | **all 14 tables = 0** (read-only preflight, 2026-10-14) |
| Data changed by P0A–P0E-2A.1 | **None** — tests run against `airprod_test` only; production has been read-only throughout |
| Historical records imported | **None** — not required (owner decision) |
| Migration `0001` rollout | Documented in `docs/MIGRATION-RUNBOOK.md` Part A; **not applied, not approved** — P0E-2 precondition |
| Production writes by P0E-1A | **None** |
| Production writes by P0E-1B | **None** — the phase ran against `airprod_test` only; production was touched only by the read-only preflight |
| Production writes by P0E-2A | **None** — production was read by `mysqldump` + `information_schema` only; the migration rehearsal ran on the disposable `airprod_rehearsal`, which was created and dropped |
| Production writes by P0E-2A.1 | **None** — the existing rehearsal was re-run (read-only `mysqldump` + disposable `airprod_rehearsal`, created and dropped); the local-backup preparation only read an existing artifact and wrote a git-ignored manifest |
| Production DB host location | **Same machine as the project workspace (`LOOPBACK` port 3306)** — this is why the owner's local-laptop/PC destination is **NOT OFF-HOST** (Section I.3) |

### R2. Production Readiness Checklist (separate from milestones) — **4 / 10**

| Item | Ready? | Note |
| --- | --- | --- |
| Data model / schema on MySQL | ✅ Yes | 13 domain tables + `job_sequences`, migrations reproducible |
| Canonical repository contract satisfied | ✅ Yes | 12/12 members, 59/59 methods (P0C-3) |
| Financial ledger guarantees | ✅ Yes | decimal strings, atomic writes, DB idempotency, derived status |
| Historical data migrated | ➖ Not required | Owner decision: Fresh Start MySQL — **not** a readiness gain |
| Application running on MySQL | ❌ No | **source converted** in P0E-1B, the `0001` migration **rehearsed** in P0E-2A, and the application now **runs locally on MySQL/MariaDB** against the dedicated `airprod_dev` database (P0E-DEV-1) — but **production** is not activated |
| Authentication / authorization | ❌ No | P1A / P1B |
| Business features (job numbering, master data, crew payment, finance UI, dashboard) | ❌ No | P2A–P2E |
| Automated + E2E UI testing | ❌ No | P3B |
| **Build green without external credentials** | ✅ **Yes — new in P0E-1B** | `npm run build` exits 0 with `GOOGLE_*` unset (Section G.16); previously ❌ |
| Deployment (Vercel) + final acceptance | ❌ No | P4A / P4B |

**Production readiness remains 4 / 10.** P0E-2A, P0E-2A.1 and P0E-DEV-1 added **no**
point: producing a rehearsed plan, harder guards and a fail-closed gate is not the same
as *satisfying* a readiness criterion, and **running locally is not production**.
P0E-DEV-1 proves the application works end-to-end on MariaDB in localdevelopment (Section J summary + [separate P0E-DEV-1 report](reports/P0E-DEV-1-local-runtime-stabilization.md)), but “Application running on MySQL” stays ❌ because **production** is still
not activated, and “Deployment (Vercel) + final
acceptance” stays ❌. The only item that has ever moved is “build green without
external credentials”, changed in P0E-1B on hard evidence (`npm run build` exit 0 with
no `GOOGLE_*` in the environment). Milestone completion is **unchanged**
(historical 27.8 %, adjusted 29.4 %); the two metrics stay independent.

### R3. Phase Reports

- `docs/FULL-PROJECT-AUDIT.md`
- `docs/PHASE-MYSQL-REDESIGN.md`
- `docs/PHASE-1-MYSQL-FOUNDATION.md`
- `docs/PHASE-P0A-MYSQL-RECOVERY.md`
- `docs/PHASE-P0B-MYSQL-REPOSITORY.md`
- `docs/PHASE-P0C1-DOMAIN-RECONCILIATION.md`
- `docs/PHASE-P0C2-FINANCIAL-REPOSITORY.md`
- `docs/PHASE-P0C3-MYSQL-SERVICE-INTEGRATION.md`
- `docs/PHASE-P0D1-MIGRATION-PLANNING.md`
- `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md`
- `docs/MIGRATION-MAPPING.md`
- `docs/MIGRATION-RECONCILIATION.md`
- `docs/MIGRATION-RUNBOOK.md`
- `docs/MIGRATION-DECISION-REGISTER.md`
- `docs/MIGRATION-SNAPSHOT-INVENTORY.md`
- `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md`
- `docs/FRESH-START-MYSQL-PLAN.md`
- [`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md) — P0E-DEV-1, **separate detailed report (first under the new policy)**

### R4. Mandatory Phase-Reporting Rule (effective from P0D-CLOSE; report layout updated from P0E-DEV-1)

For **every subsequent agent phase**, updating **this dashboard** is part of both the
**initial phase scope** and the **final acceptance criteria**: record the phase verdict,
the actual test/typecheck/lint/db:check/build results, runtime and database status,
milestone counts with correctly labelled denominators, and the production-readiness
checklist — while preserving all prior history.

**Report layout (effective from P0E-DEV-1):** each phase must also produce its **own
separate detailed Markdown report** under `docs/reports/`, and this file must carry only
a **concise summary plus a link** to it. **Do not duplicate the complete phase report in
both files.** The earlier single-file policy applied to P0E-1A … P0E-2A.1; their inline
reports (Sections C, G, H, I) are preserved unchanged.

### R5. Recommended Next Action

**Do not start P0E-2B automatically.** P0E-2A and P0E-2A.1 are complete (PASS WITH
LIMITATIONS), **P0E-DEV-1 is complete (PASS — local runtime stabilized)** and P0D
remains **SKIPPED by owner decision**. P0E-DEV-1 does **not** change the activation
gate: it only makes the application usable in local development against `airprod_dev`
(Section J summary; [separate report](reports/P0E-DEV-1-local-runtime-stabilization.md)) while keeping `database-airprod` protected and `0001` unapplied to
production. Two owner decisions are
now required **before** the P0E-2B execution gate can even be entered:

0. **A separate backup-destination decision.** The chosen local laptop/PC is the
   **same machine** as the DB host, so it is **NOT OFF-HOST** (Section I.3/I.5). Name
   a genuinely separate destination (a different machine or external device), then have
   the owner run the prepared transfer + checksum verification (`npm run
   migration:backup:local`). Until then the off-host criterion stays **BLOCKED**.
1. **P0E-2B — Production `0001` Rollout & Controlled Activation**
   (**Section H.18**, **Section I.17**; also Section F9 and Section G.23) — off-host backup +
   checksum, restore rehearsal against that destination, a populated-data rehearsal
   (or an explicit accepted risk), `0001` rollout to production inside an assigned
   window, post-migration verification, and then a **separate** runtime activation
   decision. Production migration approval, activation, and deployment are **three
   separate decisions**.
2. An owner decision on the database provider / Vercel connection strategy
   (D-CONN-1/D-CONN-2) before deployment planning (P4A).
3. Feature milestones P1A/P1B (auth) and P2A–P2E (business UI), which are
   independent of the activation gate and may be scheduled in any order the owner prefers.
   Note: the application can now be **exercised locally** end-to-end (P0E-DEV-1) to
   de-risk P2 work, but only in the private development environment — no tunnel, no
   public exposure, no deploy (authentication is still unimplemented).

No phase may be marked complete without its own verified report in this file. No
phase may apply production migrations, switch the runtime, reset data, or deploy
without a new explicit owner approval.

---

## SECTION G — PHASE REPORT: P0E-1B — CANONICAL MYSQL RUNTIME CONSUMER CONVERSION (HISTORICAL, PRESERVED)

### G.1. Phase objective and verdict

**Objective:** convert the active application consumers from the legacy Google Sheets
domain contract to canonical **MySQL Contract v2**, remove the active Google Sheets
dependency, and make the application **build without Google credentials** — without
fake legacy adapters, without production activation, and using only the isolated
test database.

**Verdict: PASS.** All 17 acceptance criteria in the phase prompt are met with
evidence (G.17–G.20). No criterion was waived, no test was weakened, and no
production object was touched.

**Scope honestly bounded:** this is **source-code conversion**, not activation. The
production database is still empty and untouched, migration `0001` is still
unapplied to production, the converted runtime has **not** been deployed or run
against production, and authentication does not exist. Those remain P0E-2 / P1A / P4B.

### G.2. Verified baseline (inspected, not assumed)

| Item | Prompt's reported baseline | Verified in the repo at P0E-1B start |
| --- | --- | --- |
| Branch / HEAD | `main` @ `7c4cc41…` | ✅ identical |
| Previous phase | P0E-1A PASS WITH LIMITATIONS | ✅ (Section C) |
| Previous tests | 221/221, 8 files | ✅ reproduced |
| TypeScript | 0 errors | ✅ |
| Lint | 0 errors, 1 pre-existing warning | ✅ (warning in `src/app/actions/job-actions.ts`) |
| `db:check` | clean | ✅ |
| Build | **FAIL** — inherited Google prerender dependency | ✅ reproduced in P0E-1A; **fixed here** |
| Active runtime | Google Sheets | ✅ (`getRepositories()` → `googleRepositories`) |
| Contract v2 | 12 members, 59 methods | ✅ re-verified from source |
| Legacy blocked methods | 17 | ✅ 17 `RepositoryBlockedError` throws (5 venues + 6 expenses + 3 + 3) |
| Production DB | `database-airprod` | ✅ read-only preflight |
| Production tables / rows | 14 tables, previously reported all empty | ✅ 14 tables, **all 0 rows** |
| Production journal | `0000` only | ✅ journal row count = 1 |
| `0001` on production | not applied | ✅ `job_id` NOT NULL, no idempotency columns/UNIQUE |
| Master progress | 5/18 = 27.8 % · skipped 1 · remaining 12 | ✅ unchanged |
| Adjusted progress | 5/17 = 29.4 % | ✅ |
| Production readiness | 3/10 | ✅ |

Nothing was reset, stashed, cleaned, reverted, committed, pushed, or deployed; all
uncommitted work was preserved.

### G.3. Exact files created, modified, and deleted (this phase)

**Created (2)**

| File | Purpose |
| --- | --- |
| `src/services/runtime.ts` | **The single composition/provider boundary.** `getApplication()` lazily builds the canonical backend via `createApplicationBackend()` (one per process), reuses the shared runtime pool, opens **no** connection at import, and has **no** Google fallback. `resetApplicationRuntime()` exists for tests only. |
| `tests/application-conversion.test.ts` | **14 focused tests** exercising the converted *service* layer (the same functions pages/actions call) against `airprod_test`, plus static dependency/build-safety enforcement. |

**Deleted (2)**

| Path | Why |
| --- | --- |
| `src/repositories/index.ts` | The legacy `getRepositories()` → `googleRepositories` barrel was the **runtime Seam** that kept Google Sheets active. Removing it makes a Google runtime dependency structurally impossible rather than merely unused. Nothing active imported it; its legacy adapter (`src/repositories/mysql/index.ts`), the Google implementation, and the mock implementation remain archived and are still exercised only by their own repository tests. |
| `src/app/venues/page.tsx` | Venue has no canonical entity (no `venues` table). Removing the route removes the broken navigation target; historical venue *names* survive as `jobs.legacy_venue_name`. |

**Modified — application routes/layout (8)**
`src/app/layout.tsx` · `src/app/dashboard/page.tsx` · `src/app/jobs/page.tsx` · `src/app/jobs/[jobNumber]/page.tsx` · `src/app/clients/page.tsx` · `src/app/vendors/page.tsx` · `src/app/crew/page.tsx` · `src/app/finance/page.tsx`

**Modified — Server Actions (4)**
`src/app/actions/master-actions.ts` · `src/app/actions/job-actions.ts` · `src/app/actions/job-detail-actions.ts` · `src/app/actions/finance-actions.ts`

**Modified — services (5)**
`src/services/master-service.ts` · `src/services/job-service.ts` · `src/services/dashboard-service.ts` · `src/services/shared.ts` · `src/services/types.ts`

**Modified — components/lib (10)**
`src/components/jobs/jobs-table.tsx` · `src/components/jobs/job-detail-tabs.tsx` · `src/components/jobs/edit-job-button.tsx` · `src/components/master/master-crud.tsx` · `src/components/finance/finance-crud.tsx` · `src/components/ui/status-badge.tsx` · `src/components/layout/sidebar.tsx` · `src/lib/navigation.ts` · `src/lib/labels.ts` · `src/lib/utils.ts`

**Modified — documentation (1, this file)** `docs/PROJECT-PROGRESS.md`.

**Total: 31 source/test paths** (27 modified + 2 deleted + 2 created) **+ this report
file.** `git diff --shortstat -- src tests` = **48 files changed, 2729 insertions(+),
1776 deletions(-)** (includes inherited earlier-phase deltas in schema/migration/test
harness files that P0E-1B did not author). HEAD is still `7c4cc41`; nothing committed.

### G.4. Application composition architecture

```
Server Component / Server Action
        │  (imports only the application service layer)
        ▼
src/services/{master,job,dashboard}-service.ts   ← converted to canonical
        │  getApplication()
        ▼
src/services/runtime.ts                          ← ONE composition boundary
        │  createApplicationBackend()   (P0E-1A foundation)
        ▼
services.canonical.*  ·  repositories.canonical.*  ·  financial (FinancialService)
        ▼
src/db/connection.ts → sharedConnection() → getDb()   (single pool)
        ▼
MySQL / MariaDB  (canonical Contract v2 schema)
```

How the prompt's requirements are satisfied:

| Requirement | How |
| --- | --- |
| Single composition/provider boundary | `src/services/runtime.ts` is the only module that constructs the backend. Verified: no other file constructs it, and no page/action imports a concrete provider. |
| Reuse Contract v2, no competing contract | Only `createApplicationBackend()`/`createMySqlApplication()` are used. The legacy `DataRepositories` contract is untouched but off the runtime path. |
| Explicit dependency injection | `createApplicationBackend({ connection? })` (P0E-1A); the runtime passes nothing in production and the tests use `isolatedConnection(testUrl)`. |
| No connection at import / build | `getApplication()` is lazy; `getDb()` builds a `mysql2` pool lazily. The build's static routes never call it. |
| No Google fallback | The runtime path cannot reach Google: the barrel that exposed `googleRepositories` is deleted, and a test forbids `@/repositories/google`, `@/lib/google-sheets`, `@/repositories/types`, `from "@/repositories"`/`@/repositories/index`, `@/lib/types`, and any `getRepositories` call inside `src/app/**` + `src/services/**`. |
| No broad `any`, silent catch, or fabricated data | Errors propagate (`throw`/`{ ok:false, error }`); missing records return explicit errors or `null`; empty reads return valid empty collections. |
| Presentation mapping only where needed | `src/services/types.ts` was rewritten as a **view model** layer over canonical entities (no `venue`, no `expense`, no stored status, money as `Amount` decimal strings). |
| No two competing active implementations | The Google repository, the mock repository, and the legacy MySQL adapter remain **archived** and are unreachable from any active page/layout/action/service. |

### G.5. Consumer conversion matrix (verified against the actual code)

| # | Original consumer | Was | Now | Status |
| --- | --- | --- | --- | --- |
| 1 | `src/app/layout.tsx` | `getCurrentAdmin()` at render → Google client → **build failure** | I/O-free layout; static shell label | ✅ converted |
| 2 | `src/app/page.tsx` | `redirect` only | unchanged (no dependency) | ✅ n/a |
| 3 | `src/app/dashboard/page.tsx` | `dashboard-service` (incl. **venues**) | canonical `jobs` + `master` + `deliveries`; dynamic | ✅ converted |
| 4 | `src/app/jobs/page.tsx` | `job-service` + `master-service` incl. **venues** | canonical jobs/clients/vendors; dynamic | ✅ converted |
| 5 | `src/app/jobs/[jobNumber]/page.tsx` | `job-service` detail + **venues**/expenses/stored status | canonical detail: job + counterparty + assignments + deliveries + schedules + cashflows + totals; dynamic | ✅ converted |
| 6 | `src/app/clients/page.tsx` | legacy `Client` fields | canonical client fields (`companyName/contactPerson/email/clientType/…`); dynamic | ✅ converted |
| 7 | `src/app/vendors/page.tsx` | `master-service.getVendors` | canonical vendors; dynamic | ✅ converted |
| 8 | `src/app/crew/page.tsx` | free-text **role** | canonical `crew_roles` select + full crew-role CRUD panel; dynamic | ✅ converted |
| 9 | `src/app/venues/page.tsx` | venue CRUD via `getVenues` | **route deleted** — no canonical venue entity | ✅ removed |
| 10 | `src/app/finance/page.tsx` | `getFinanceOverview` incl. **expenses** + stored status | canonical schedules + cashflows + **derived** status + general expense + ledger; dynamic | ✅ converted |
| 11 | `src/app/actions/master-actions.ts` | legacy master CRUD + venues | canonical master + crew-role actions | ✅ converted |
| 12 | `src/app/actions/job-actions.ts` | `job-service` (venue, `venueId`) | canonical job CRUD, manual UNIQUE `jobNumber`, XOR counterparty | ✅ converted |
| 13 | `src/app/actions/job-detail-actions.ts` | `job-service` + **direct `@/repositories` import** | canonical services; direct barrel import gone; crew cash recording added | ✅ converted |
| 14 | `src/app/actions/finance-actions.ts` | payments/expenses incl. stored status | canonical schedules + cashflows + general expense, idempotency key required | ✅ converted |
| 15 | `src/components/jobs/jobs-table.tsx` | `@/lib/types`, `@/services/types` legacy | canonical `domain` types; venue field removed | ✅ converted |
| 16 | `src/components/jobs/job-detail-tabs.tsx` | `Crew/JobCrew/PaymentStatus` legacy; stored status | canonical view models; derived status; crew-role selection; cash recording | ✅ converted |
| 17 | `src/components/jobs/edit-job-button.tsx` | legacy `Job` + venue fields | canonical `Job`; “Nama Venue (histori)” free text only | ✅ converted |
| 18 | `src/components/master/master-crud.tsx` | generic (no repo import) | extended with `select`/`error`/`hint` field support for canonical forms | ✅ updated |
| 19 | `src/components/finance/finance-crud.tsx` | generic (no repo import) | extended with `filter`, `totals`, and create-only modes for the cash ledger | ✅ updated |
| 20 | `src/components/ui/status-badge.tsx` | `@/lib/types` | canonical `@/domain/types` | ✅ converted |
| 21 | `src/lib/labels.ts` | legacy types + legacy `EXPENSE_CATEGORIES` | canonical labels incl. `CASHFLOW_CATEGORY_LABEL`, `PAYMENT_STATUS_LABEL`, `CLIENT_TYPE_LABEL`, `GENERAL_EXPENSE_CATEGORIES` | ✅ converted |
| 22 | `src/services/master-service.ts` | `getRepositories()` (Google) | canonical master + admin-session reads via `getApplication()` | ✅ converted |
| 23 | `src/services/job-service.ts` | `getRepositories()` | canonical jobs/deliveries/schedules/cashflows + derived status | ✅ converted |
| 24 | `src/services/dashboard-service.ts` | `getRepositories()` incl. venues | composed from canonical jobs/deliveries; `legacyVenueName` display only | ✅ converted |
| 25 | `src/services/shared.ts` | `@/lib/types` (types only) | canonical `@/domain/types`; no legacy import | ✅ converted |
| 26 | `src/services/types.ts` | legacy view models | canonical view models (no venue/expense/stored status) | ✅ converted |

**No entry remains on a legacy or Google dependency**, and **no fake legacy adapter
was introduced**. Not deleting the archived Google/mock/legacy-adapter code is
deliberate (Section G.13).

### G.6. Root-layout and build fix (highest-priority criterion)

- `src/app/layout.tsx` no longer calls `getCurrentAdmin()` and imports no service or
  DB module. It renders a static shell label `Admin`. **This is explicitly not
  authentication**: with no auth (P1A/P1B) there is no real “current admin”, so no
  fake admin account was created and the label is not treated as authorization.
- All 7 data routes declare `export const dynamic = "force-dynamic"`; `/` and
  `/_not-found` stay static. Result of `npm run build`:

```
○ /          ○ /_not-found
ƒ /clients   ƒ /crew   ƒ /dashboard   ƒ /finance   ƒ /jobs   ƒ /jobs/[jobNumber]   ƒ /vendors
```

- **No `/venues` route is emitted**, and the prerender step no longer reaches the
  Google client. The previously failing chain
  `layout → master-service → Google client → missing GOOGLE_SHEETS_ID` is gone at
  its root cause (no build-time data read at all).
- An empty database renders correctly because the routes are server-rendered per
  request and the canonical services return valid empty collections (G.15).

### G.7. Master-data conversion

| Area | Implementation |
| --- | --- |
| Clients | Canonical fields only (`name` + `companyName/contactPerson/phone/email/address/clientType/notes`). Legacy-only concepts were dropped rather than mapped onto unrelated canonical fields. `clientType` is validated with `isClientType`. |
| Vendors | Canonical vendor fields (`name/contactPerson/phone/email/notes`). |
| Crew | `crewRoleId` is **required** and must resolve to an existing `crew_roles` row; `defaultPayment` is a decimal-string `Amount` normalised by `parseAmountInput` (invalid input → explicit error, never a guessed number). |
| Crew roles | The `/crew` page hosts a second managed panel (`create/update/delete`) over the canonical `crew_roles` table — the minimum needed for canonical role selection. It is deliberately a thin CRUD, not a P2B feature build-out. |
| Empty states | `/clients`, `/vendors`, `/crew` render the shared `EmptyState` when there are zero rows. **No sample/seed data is ever inserted.** |

### G.8. Jobs and job-detail conversion

- **Listing:** `getJobListItems()` composes canonical jobs with a resolved
  counterparty (`resolveCounterparty`, client XOR vendor) and sorts by `jobNumber`.
- **Create/update/delete:** `createJob`/`updateJob`/`deleteJob` go through
  `services.jobs`; `jobNumber` remains **manual** (auto-numbering is P2A) and
  uniqueness is enforced twice: an explicit pre-check with the message
  “Job number '<x>' sudah dipakai job lain.” plus the canonical/DB UNIQUE constraint.
- **Counterparty:** the XOR rule is validated in the action (`CLIENT` xor `VENDOR`),
  in the canonical repository, and by a DB CHECK — a job with both, or neither, is rejected.
- **Job detail:** `getJobDetail(jobNumber)` returns the job, its counterparty, crew
  assignments with resolved role + derived settlement, deliveries, client and vendor
  schedules with **derived** status, the canonical cashflow ledger for the job, and
  financial totals. A missing job returns `null` → the page calls `notFound()`.
- **Venue:** removed from the job form. `legacyVenueName` survives only as an
  optional free-text historical snapshot shown as “Venue (histori)”.

### G.9. Crew-role and assignment conversion

- `job_crews.crew_role_id` is a nullable **override**; when absent the crew member's
  master `crewRoleId` applies. The effective role name is resolved from `crew_roles`
  and displayed (test asserts the inherited role name appears).
- Creating/updating an assignment sets only the **obligation** (`agreedAmount`); it
  moves **no cash** (test asserts `detail.cashflows` is empty and `totals.crewAgreed`
  equals the agreed amount, while status is `UNPAID`).
- Recording crew cash uses `recordCrewPayment` (canonical cashflow, idempotency key
  required) and status then moves `UNPAID → PARTIAL → PAID` by derivation
  (200.00 of 500.00 → `PARTIAL`, remaining 300.00 → `PAID` at 500.00).
- No `paymentStatus` field is ever written or read on an assignment.

### G.10. Finance and cashflow conversion

The obligation/cash separation is enforced everywhere:

| Concept | Canonical implementation | UI surface |
| --- | --- | --- |
| Client obligation | `financial.createClientPaymentSchedule` / `update…` | “Jadwal Tagihan Client” (create + update; the canonical contract exposes **no** schedule delete, so the UI offers none rather than inventing one) |
| Vendor obligation | `financial.createVendorPaymentSchedule` / `update…` | “Jadwal Pembayaran Vendor” |
| Actual client cash | `financial.recordClientPayment` | “Catat Kas Masuk” (create-only) |
| Actual vendor cash | `financial.recordVendorPayment` | “Catat Kas Keluar” (create-only) |
| Crew obligation + cash | `jobCrewAssignments` + `financial.recordCrewPayment` | job-detail crew tab |
| General expense | `financial.recordGeneralExpense` (cashflow, `direction=EXPENSE`, `job_id` **nullable**) | “Biaya Operasional (Kas Keluar)” |
| Ledger + totals | `cashflows.getAll()` + `cashflows.totals({})` | read-only “Arus Kas” with income/expense/net |
| Payment status | **derived** (`derivePaymentStatus`/`deriveSettlement` over real cashflows) | every table shows the derived label |

Preserved invariants (all covered by tests): decimal-string `Amount` values (never
floats in domain logic), atomic canonical writes, **DB-backed idempotency**
(`UNIQUE(idempotency_key)` + payload fingerprint), explicit error propagation, and
canonical validation. No legacy `expenses` table was reintroduced, no stored
payment status was reinstated as truth, and no invariant was weakened to make the UI
work. A cash row is create-only in the UI — it can be neither edited nor deleted —
matching the append-only ledger design.

### G.11. Venue removal

| Surface | Action |
| --- | --- |
| Route | `src/app/venues/page.tsx` **deleted** (directory gone) |
| Navigation | `src/lib/navigation.ts` — Venues entry removed; sidebar renders only the 6 real modules; `NAV_ITEMS` contains no `/venues` |
| Job form | Venue **entity picker** removed; only an optional free-text “Nama Venue (histori)” remains |
| Job detail | Shows `legacyVenueName` as historical text or `-` |
| Dashboard | Uses `legacyVenueName` as a secondary line or falls back to `jobNumber` |
| Shared types | `JobListItem`/`IncomingWeddingItem` carry `legacyVenueName?: string` only — no `venueId`, no `Venue` type |
| Repository | **No** venue repository, no venue table, no fake implementation was created |
| Historical tooling | `src/migration/venue-archive.ts` and the Google mapping are untouched |

Static test enforces: the `src/app/venues` directory does not exist, the nav source
contains no `"/venues"`/`Venues`, and no active file in `src/app`+`src/services`
mentions `venueId`, `createVenue`, `updateVenue`, `deleteVenue`, or `getVenues`.

### G.12. Server Action conversion

All four required action modules were converted to import the canonical service layer
only, and all four keep explicit input validation and honest error propagation:

- **Errors are returned, not swallowed:** each action returns
  `{ ok: true } | { ok: false, error }`; a failed financial write can never be
  reported as success.
- **`src/app/actions/job-detail-actions.ts`** no longer imports the legacy
  `@/repositories` barrel; its revalidation resolves the job through
  `getApplication().services.jobs.getJobById` and revalidates `/jobs/[jobNumber]`.
- **Idempotency keys are mandatory** for every cash-recording action
  (`requireIdempotencyKey`), so UI writes cannot bypass the DB idempotency guarantee.
- **Amounts** pass through `parseAmountInput`, which returns `null` for invalid input
  and is rejected explicitly (no silent coercion).
- **Validation uses canonical type guards** (`isJobCategory`, `isJobStatus`,
  `isDeliveryStatus`, `isClientPaymentTerm`, `isVendorPaymentType`, `isClientType`).
- **No production writes occur during verification:** the actions are only exercised
  through the test database; no action was invoked against production.

### G.13. Legacy dependency cleanup (evidence, not a text scan)

Both a **static** check and **behavioural** tests were used — a text scan alone was
not accepted as proof.

Static enforcement (test, comment-stripped, over **every** `.ts/.tsx` in
`src/app/**` and `src/services/**`):

| Forbidden in active code | Result |
| --- | --- |
| `@/lib/google-sheets` | absent |
| `@/repositories/google` | absent |
| `@/repositories/types` | absent |
| `from "@/repositories"` / `@/repositories/index` | absent |
| `@/lib/types` | absent |
| `\bgetRepositories\b` | absent |
| `@/services/*` imports in the root layout | absent (layout is I/O-free) |

Behavioural proof that the *real* runtime path is canonical: `application-conversion.test.ts`
calls the converted **service functions** (not repositories) and asserts
`select database()` equals `airprod_test` before doing anything else, so a Google or
production path could not silently satisfy them.

**Deliberately kept (archived, unreachable from the runtime):**
`src/repositories/google/**` (Google implementation), `src/repositories/mock/**`,
`src/repositories/mysql/index.ts` (legacy-contract adapter whose 17 methods still
throw `RepositoryBlockedError`), `src/repositories/types.ts`, `src/lib/types.ts`,
`src/data/mock/**`, all `src/migration/**` and `src/migration-cli/**` historical
tooling, and the docs. These are **not deleted**; they are simply no longer on any
active path. `tests/mysql-repository.test.ts` continues to exercise the archived
adapter, including its blocked-method behaviour.

### G.14. Isolated test-database evidence (`airprod_test` only)

`tests/setup.ts` performs, in order: load `.env` → **guard** (`resolveTestDatabaseUrl()`
refuses to proceed unless `DATABASE_URL` points at `database-airprod`) →
`CREATE DATABASE IF NOT EXISTS airprod_test` → point `process.env.DATABASE_URL` at
`airprod_test` → `dropAllTestTables()` (which itself refuses any URL that is not
`airprod_test`) → apply the `drizzle/` migration chain. Consequences:

- The test database name is **explicitly verified**, the harness **fails closed**
  when the URL is absent/ambiguous or points at production, and no connection string
  or secret is ever printed.
- The first assertion in `application-conversion.test.ts` independently re-proves the
  resolved database is `airprod_test` at runtime.
- Migration `0001` is part of the applied chain, so it was **verified, not reapplied**.

14 tests, all passing:

| # | Test | What it proves |
| --- | --- | --- |
| 1a | Runtime connection points at the test DB | No accidental production target |
| 1b | `0001` schema verified on the test DB | `job_id` nullable; both idempotency columns present; `uq_cashflows_idempotency_key` exists |
| 1c | Empty database | All lists `[]`, dashboard summary all-zero, `finance.totals` = `"0.00"`×3, `getCurrentAdmin()` → `null` |
| 2a | Client CRUD | Canonical fields persist; `clientType` update works; read/delete verified |
| 2b | Crew → `crew_roles` FK | Real role resolves through the directory; **ghost role rejected** (no implicit creation); role delete verified |
| 3 | Job canonical rules | Manual unique `jobNumber` (duplicate → explicit “sudah dipakai” error); XOR violation rejected; counterparty composed correctly; update/delete verified; missing detail → `null` |
| 4 | Crew obligation vs cash | Assignment creates **no** cash; `UNPAID → PARTIAL → PAID` by derivation incl. `paidAmount`/`remainingAmount` |
| 5 | Delivery | Created per job and present in job detail |
| 6a | Finance core | Schedule 1000.00, cash 400.25 → `PARTIAL` remaining `599.75`; **identical replay returns the same `cashflowId`**; same key + different amount → `RepositoryConflictError`; completed → `PAID`; expense with **no job** appears with `jobLabel = "-"`, direction `EXPENSE`; ledger totals equal the ledger contents |
| 6b | Vendor payment | Reduces the vendor schedule to `PAID` |
| 7a | Active-source boundary | No forbidden import/`getRepositories` in `src/app`+`src/services` |
| 7b | Root layout build safety | No `getCurrentAdmin`, no `getApplication`, no `@/services`/`@/db`, not `async` |
| 7c | Route rendering | All 7 data pages declare `force-dynamic` |
| 7d | Venue removal | No `src/app/venues` dir; no nav entry; no venue API in active code |

**Production was never used as a test target**, and no test writes to
`database-airprod`.

### G.15. Migration `0001` verification (test DB only)

`0001` was **already in the applied migration chain** for `airprod_test`, so — per the
phase instruction — the resulting **schema was verified** rather than reapplied.
`information_schema` probes confirm:

| Requirement | Verified on `airprod_test` |
| --- | --- |
| `cashflows.job_id` nullable | `IS_NULLABLE = YES` |
| `idempotency_key` | present, nullable |
| `idempotency_fingerprint` | present, nullable |
| `UNIQUE` idempotency enforcement | index `uq_cashflows_idempotency_key` present, and a conflicting-replay write actually raises `RepositoryConflictError` |
| Additive-only changes | `crew.default_payment`/`job_crews.agreed_amount` default `'0.00'` |

Focused canonical financial writes were then run against the isolated database
(G.14 #6): schedule creation, partial and full cash recording, idempotent replay,
IDEMPOTENCY conflict, jobless general expense, and derived-status transitions.

**Production prerequisites and rollback considerations** are documented in **F9**
(backup + checksum, restore rehearsal, stop-the-app window, test-first ordering,
additive DDL list, and the fact that `0001` has **no down-migration** so rollback is a
dump restore). **`0001` was NOT applied to `database-airprod`** — production rollout
belongs to P0E-2.

### G.16. Build and environment verification

Run with the Google variables **unset** (`env -u GOOGLE_SHEETS_ID -u
GOOGLE_SERVICE_ACCOUNT_EMAIL -u GOOGLE_PRIVATE_KEY -u GOOGLE_SHEETS_SPREADSHEET_ID
npm run build`):

| Check | Result |
| --- | --- |
| `GOOGLE_*` variables present in the environment | **0** — nothing was faked to make the build pass |
| Compile | ✓ Compiled successfully |
| TypeScript (in-build) | ✓ Finished, no errors |
| Static generation | ✓ 4/4 pages |
| **Exit code** | **0** |
| Emitted routes | `/`, `/_not-found` static; the 7 data routes dynamic; **no `/venues`** |

Acceptance checks from the prompt, each satisfied:

1. Google Sheets credentials are **not required** by active application code. ✅
2. **No** production database connection is required during the build. ✅
3. Dynamic runtime data is handled through Next.js boundaries (`force-dynamic`). ✅
4. Missing runtime configuration fails **explicitly and safely** when the operation is
   actually invoked (`getDatabaseUrl()` → explicit error at first use, not at import). ✅
5. Empty-data UI renders correctly (G.14 #1c, G.7). ✅
6. No fabricated production data is returned. ✅
7. `npm run build` **exits 0**. ✅

No environment variable was modified, no credential was invented, and no secret
value was printed.

### G.17. Tests before and after

| | Files | Tests |
| --- | --- | --- |
| Before P0E-1B | 8 | **221 / 221** |
| After P0E-1B | **9** | **235 / 235** |
| Delta | +1 file | **+14 tests** (`tests/application-conversion.test.ts`) |

Per file after: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` 46 ·
`migration-snapshot` 39 · `application-foundation` 7 · **`application-conversion` 14**.
`vitest run` exit code **0**. **No existing test was deleted, skipped, weakened, or
had an assertion relaxed.**

Coverage added against the prompt's list: canonical application consumer integration
(#1–#6), root-layout build safety (#7b), no Google Sheets dependency in active routes
(#7a), master-data reads/writes (#2a), crew-role references (#2b), jobs
list/detail/create/update/delete (#3), job-number uniqueness (#3), crew assignments
(#4), deliveries (#5), finance schedules (#6), actual cashflow recording (#6),
derived payment status (#4/#6), general expenses (#6a), idempotency (#6a), venue
removal (#7d), empty database (#1c), explicit missing-record errors (#3/#1c),
database test isolation (#1a) and no accidental production writes (#1a + the harness
guards).

**Limitation reported honestly:** there is no browser/E2E UI test yet (that is P3B),
and the build cannot be executed as a Vitest test in this environment; the build was
verified by running the real `npm run build` command and recording its exit code
(G.16).

### G.18. TypeScript / lint / db:check / preflight results

| Command | Result | Exit code |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0** |
| `npm run lint` | 0 errors, **0 warnings** | **0** |
| `npm run db:check` | `Everything's fine 🐶🔥` (schema ⟷ journal consistent) | **0** |
| `npx vitest run` | **235 passed / 235** (9 files) | **0** |
| `npm run build` | compiled, type-checked, 4/4 static pages, **no Google credentials** | **0** |
| `npm run migration:preflight` | read-only production preflight, no drift (G.19) | **0** |

The former P0E-1A lint warning (`src/app/actions/job-actions.ts` unused legacy `Job`
import) **no longer exists** because that file no longer imports a legacy type — it was
fixed by the conversion, not by a suppression. **Inherited failures vs new failures:**
the only inherited failure was the build, and it is **fixed**; **no new failure was
introduced.**

### G.19. Production safety proof

- **MySQL:** production was touched **only** by `npm run migration:preflight`, which
  uses SELECT/`information_schema` and refuses any database other than
  `database-airprod`. Result (exit 0): 14 tables, **all 0 rows**; journal = `0000`
  (row count 1); `cashflows.job_id` **NOT NULL**; idempotency columns **absent**;
  UNIQUE idempotency index **absent**; FK `cashflows_job_id_jobs_id_fk` intact;
  `crew.default_payment = 0.00`, `job_crews.agreed_amount = 0.00`; **no drift**. No
  INSERT/UPDATE/DELETE/DDL/seed/migrate/truncate/drop/reset was executed against it,
  and `airprod_test` was never treated as production.
- **Google Sheets:** **no access of any kind** — no read, write, format, or delete,
  and no credential was requested. Archived migration tooling was not run against the
  real spreadsheet.
- **Repository:** no reset/stash/clean/revert; the working tree still contains every
  P0A→P0E-1B change. **Nothing was committed, pushed, or deployed**; HEAD is still
  `7c4cc41`.
- **No data or tooling was deleted:** the Google implementation, the mock repository,
  the legacy MySQL adapter, the legacy contract types, and all `src/migration/**`
  tooling remain in the repository.

### G.20. Outstanding blockers

| # | Open item | Consequence | Owner action | Phase |
| --- | --- | --- | --- | --- |
| B-5 | `0001` not applied to production | Canonical cashflow/expense writes (incl. jobless expenses) fail on production | Approve rollout: window, operator, backup + checksum, restore rehearsal | P0E-2 |
| B-6 | Production activation not approved | The converted runtime is unverified in a deployed environment | Separate explicit activation gate | P0E-2 |
| B-7 | Vercel DB provider/pooling undecided (D-CONN-1/D-CONN-2) | Deployment target and serverless pool strategy unknown | Decide provider + connection strategy | P0E-2 / P4A |
| B-8 | No authentication/authorization | No login; “Admin” label is a placeholder, not security | Implement | P1A/P1B |
| B-9 | No automatic job numbering | `jobNumber` stays manual (UNIQUE-enforced) | Implement | P2A |
| B-10 | Remaining business UI depth (crew UX, dashboard/delivery, forms; no schedule delete in the canonical contract) | Feature incomplete, though functional | Feature work | P2B–P2E |
| B-12 | 90 uncommitted changed/untracked paths (89 carried from P0A–P0E-1B + 1 new test file), incl. the pre-existing `dotenv` delta | Review before committing | Owner commit decision | — |
| B-13 | Converted runtime not exercised in a deployment | Tests + build prove the source, not a live environment | P0E-2 / P1A | P0E-2 / P1A |

No open item is a defect in the conversion itself; each is either a separately
gated owner decision or an explicitly later milestone.

### G.21. Owner decisions

1. **Executed with the given authorisation:** the owner authorised **P0E-1B only**
   (source conversion + isolated database testing + build verification). That is the
   authorization boundary this report stays inside.
2. **Not used, not requested:** production MySQL activation, production writes,
   production `0001`, production seeding, deployment, deletion of historical data,
   commit/push, and automatic continuation to P0E-2.
3. **Still required from the owner** (none of these was assumed):
   - D-ACT-1 — go/no-go for the **production `0001` rollout** (window, operator,
     backup location + checksum, restore rehearsal, rollback owner).
   - D-ACT-2 — go/no-go for **production runtime activation** (separate decision).
   - D-CONN-1 — database provider; **D-CONN-2** — connection/pooling strategy.
   - A commit/push decision for the 90-path working tree.
4. **Interpretation note recorded for transparency (one planned change, no fake
   adapter):** the P0E-1B plan (Section F) said the MySQL provider would be installed
   behind `getRepositories()`. It was implemented instead by **deleting** the legacy
   barrel and giving the application **one explicit composition boundary**
   (`src/services/runtime.ts`). This is the same “one owner of backend construction”
   requirement, with strictly less legacy surface (a Google-returning provider can no
   longer be reintroduced by accident), and it introduces no competing repository
   contract. Flagged here because it deviates from the literal wording of the plan.

### G.22. Overall roadmap progress

| Metric | Value | Change |
| --- | --- | --- |
| Completed milestones | **5 / 18** (P0A, P0B, P0C-1, P0C-2, P0C-3) | **unchanged** |
| Skipped by owner decision | **1** (P0D) | unchanged |
| Remaining | **12** (P0E → P4B) | unchanged |
| Historical completion | **5 / 18 = 27.8 %** | **unchanged** |
| Adjusted active-roadmap completion | **5 / 17 = 29.4 %** | **unchanged** |
| Production readiness | **4 / 10** | **3 → 4**, solely from the now-evidenced “build green without external credentials” criterion |

**P0E remains IN PROGRESS.** P0E-1A is PASS WITH LIMITATIONS (historical), P0E-1B is
**PASS**, and P0E-2 is **NOT STARTED**. Passing a subphase does **not** complete P0E
and does **not** raise the milestone percentage (per the roadmap rules).

### G.23. P0E-2 proposed scope and entry requirements (NOT STARTED)

The full gate is specified in **F9**. Summary: **entry** = build green (✅ done),
full suite green (✅ done), `0001` verified on `airprod_test` (✅ done), current
`db:check`/preflight clean (✅), plus a written go/no-go, a checksummed backup, a
restore rehearsal, and the D-CONN-1/D-CONN-2 decision (❌ open). **Scope** = backup →
restore rehearsal → `0001` on `airprod_test` → `0001` on `database-airprod` in a
maintenance window → re-verify journal/schema → controlled runtime activation →
post-activation smoke tests. **Rollback** = restore the pre-migration dump (no
down-migration exists) and/or revert the single composition boundary. **Explicitly out
of P0E-2's automatic scope:** deployment (P4A/P4B) and feature milestones (P1A–P2E).

### G.24. Final verdict

**PASS.** The active application consumers now use canonical MySQL Contract v2 through
a single composition boundary; **no fake legacy adapter** was introduced; the active
Google Sheets dependency is gone from `src/app` and `src/services` (both
statically and behaviourally verified); the root layout is I/O-free; **`npm run build`
exits 0 with no Google credentials present**; `tsc`/`lint`/`db:check`/`preflight` all
exit 0; **235/235** tests pass with none weakened; canonical financial invariants
(obligation ≠ cash, derived status, DB-backed idempotency, atomic writes) are intact;
Venue is absent from the active UI; payment status is derived from actual cashflow;
the application renders an empty database correctly; **the production database is
untouched**; **migration `0001` remains unapplied to production**; and **no commit,
push, deployment, or production activation occurred**.

---

## SECTION H — PHASE REPORT: P0E-2A — PRODUCTION ACTIVATION READINESS & RESTORE REHEARSAL (HISTORICAL, PRESERVED)

### H.1. Objective, exact scope, and verdict

**Objective:** prepare an evidence-based production activation gate and **verify that
the existing MySQL migration and recovery process can actually be executed safely** —
without migrating, activating, deploying, exposing, or writing to production.

**In scope (executed):** audit the migration runner, `0000`/`0001`, Drizzle journal,
connection lifecycle, test-DB guards and the runbook; run a strictly read-only
production preflight; design **and execute** a guarded backup/restore rehearsal in an
isolated disposable database; verify `0001` (schema, constraints, journal, canonical
finance, repeat safety) on that database; review the MySQL connection strategy for a
future Vercel deployment; produce the P0E-2B execution gate; evaluate the risk of
activating before P1A/P1B authentication; update this single report.

**Out of scope (not done):** production `0001`, any production write, production
activation, deployment/public exposure, Google Sheets access, historical data import,
new business features, auth implementation, job numbering, UI redesign, commit/push.

**Verdict: PASS WITH LIMITATIONS.**

- Every mandatory scope item was completed and verified, and the full rehearsal chain
  passed **26/26 checks** (Section H.5–H.6).
- **One sub-criterion is BLOCKED:** the runbook requires the backup to be stored
  *outside the app host* (`docs/MIGRATION-RUNBOOK.md` A.3). No off-host destination
  exists here and none was authorized, so an off-server copy **cannot be created or
  verified**. This is reported as **BLOCKED**, not as a pass (Section H.5, check
  `P0E2A-B1`).
- Two further limitations are honest scope boundaries rather than failures: the
  rehearsal ran against an **empty** production clone (so data-volume/timing behaviour
  is unmeasured), and the provider/pooling decisions (D-CONN-1/D-CONN-2) plus the
  maintenance window/operator/rollback owner remain **owner decisions**.

### H.2. Verified starting baseline (rechecked, not trusted)

| Item | Prompt's reported baseline | Verified in the repository |
| --- | --- | --- |
| Verdict / branch / HEAD | P0E-1B PASS · `main` @ `7c4cc41…` | ✅ identical (`git log -1`) |
| Tests | 235/235, 9 files | ✅ reproduced before any change |
| TypeScript | 0 errors | ✅ |
| ESLint | 0 errors, 0 warnings | ✅ |
| `db:check` | clean | ✅ |
| Build with all `GOOGLE_*` unset | PASS | ✅ reproduced |
| Active source | canonical Contract v2 via `src/services/runtime.ts` | ✅ |
| `database-airprod` | 14 tables, all 0 rows, journal `0000` only | ✅ preflight exit 0 |
| `0001` | verified on `airprod_test`, not applied to production | ✅ |
| P0D | SKIPPED BY OWNER DECISION | ✅ |
| Master progress | 5/18 completed · 1 skipped · 12 remaining | ✅ |
| Historical / adjusted progress | 27.8 % / 29.4 % | ✅ |
| Production readiness | 4/10 | ✅ |

**Discrepancy found and corrected (documentation only):** the P0E-1A and P0E-1B
reports stated that *no* managed MySQL/MariaDB service exists in the available service
catalog. A fresh catalog query returns **PlanetScale** (MySQL-compatible, Vitess) and
**Aiven** (managed MySQL/MariaDB among others) as listed options. Those reports are
left as written (historical record); the corrected statement and its consequences are
in **Section H.7**. No other baseline item differed.

### H.3. Changed files (this phase)

**Created (3)**

| File | Purpose |
| --- | --- |
| `src/migration-cli/activation-guards.ts` | Pure, fail-closed guards: only production may be a backup **source**; only `airprod_rehearsal` may be a rehearsal **target** or a `DROP DATABASE` target; artifact-path sanitising; Git-ignore detection; safe dump-file naming. No I/O, no credentials. |
| `scripts/p0e2a-rehearsal.mjs` | The rehearsal runner (backup → restore → verify → `0001` → re-run safety → canonical finance → cleanup). Credentials go through a temporary mode-0600 `--defaults-extra-file` (never argv, never printed) and are deleted afterwards. |
| `tests/activation-readiness.test.ts` | **15 DB-free tests** for the guards, artifact protection, and the additive-only `0001` / journal invariants, plus a check that the production path uses the real Drizzle migrator. |

**Modified (3)**

| File | Change |
| --- | --- |
| `.gitignore` | Added `.migration-backups/` (dump archives are **not** to be committed). |
| `package.json` | Added `migration:rehearsal` (`--experimental-transform-types` so the runner can import the app's TypeScript services; the file already carried a pre-existing `dotenv` delta). |
| `docs/PROJECT-PROGRESS.md` | This section, the dashboard, roadmap, log, blocker register and appendix updates. |

**Runtime artefact (not source, git-ignored):**
`.migration-backups/database-airprod-20261014033223-c0f4b6ed2f93.sql` — 18 708 bytes,
mode `0600`, sha256 `c0f4b6ed2f93b0017edeecdd816c62896062f030f8383254aaa9b14ba80e2e36`.
Redundant artefacts from the two failed first runs were deleted; one verified artefact
is retained. **No existing test was deleted, skipped or weakened; no production or
legacy source file was modified.**

### H.4. Read-only production evidence

`npm run migration:preflight` (exit **0**) — `SELECT`/`information_schema` only, and the
run refuses any database other than `database-airprod`:

| Aspect | Value |
| --- | --- |
| Server | MariaDB **11.8.8** |
| Database | `database-airprod` |
| Tables | **14** |
| Row counts | `admins, cashflows, clients, client_payments, crew, crew_roles, deliveries, jobs, job_crews, job_sequences, sessions, vendors, vendor_payments` = **0** each; `__drizzle_migrations` = **1** |
| Journal | `0000` only (`#1`) |
| `cashflows.job_id` | **NOT NULL** (baseline fingerprint holds) |
| Idempotency columns / UNIQUE | **absent** |
| Foreign key | `cashflows_job_id_jobs_id_fk: job_id → jobs.id` intact |
| Defaults | `crew.default_payment = 0.00`, `job_crews.agreed_amount = 0.00` |
| Schema drift | **none** |

**Environment note recorded deliberately:** the same MariaDB server hosts unrelated
schemas belonging to other projects (e.g. `airprod_test` plus several non-AirProd
names). Addressed only by name for target verification; never read, listed for data,
or modified by this phase's tooling — and the guards refuse every name except
`database-airprod` (read) and `airprod_rehearsal` (write/drop).

### H.5. Backup and restore rehearsal evidence

The rehearsal ran via `npm run migration:rehearsal` and exited **0** with **26/26
checks passing**. Every step is guarded so it cannot touch production for writes or
use the shared test database.

| # | Check | Result |
| --- | --- | --- |
| P0E2A-1 | Backup source is the intended production database | ✅ |
| P0E2A-2 | Rehearsal target is the dedicated disposable database | ✅ `airprod_rehearsal` |
| P0E2A-3 | Backup archive is protected from Git | ✅ `.gitignore` — `git check-ignore` confirms |
| P0E2A-4 | Storage sufficient before writing | ✅ ~68 GB free |
| P0E2A-5 | Logical dump created, checksum recorded | ✅ sha256 `c0f4b6ed…`, 18 708 bytes |
| P0E2A-6 | Archive stored outside version control | ✅ `.migration-backups/…`, mode `0600` |
| P0E2A-7 | Dump restores into a clean database | ✅ exit 0 |
| P0E2A-8 | Restored schema identical to production | ✅ schema fingerprint match (`f5be707fcd269457…`) |
| P0E2A-9 | Restored journal and row counts identical to production | ✅ 1 journal entry, 14 tables |
| P0E2A-26 | Disposable database removed afterwards | ✅ |
| **P0E2A-B1** | **Backup copy exists OUTSIDE the app host** | ❌ **BLOCKED** — no off-host destination available or authorized |

Pre-backup prerequisites (prompt §4) were each verified **before** any dump was taken,
and re-verified empirically by execution rather than assumed:

| Prerequisite | Evidence |
| --- | --- |
| Actual database target | `DATABASE_URL` parsed and the database name asserted to equal `database-airprod`; `database()` on the live connection returned `database-airprod` |
| Intended destination | `.migration-backups/` under the project root, created and written to; resolved and reported as a project-relative path |
| Available storage | `df -Pk` on the destination: ~68 GB free against an 18 708-byte artifact |
| Required privileges | Proved by the operations themselves: `SELECT`/`SHOW` on production (dump) succeeded; `CREATE DATABASE` + `DROP DATABASE` succeeded for `airprod_rehearsal` only; `mysql` restore and the Drizzle migrator wrote to the rehearsal database successfully. No privilege escalation, no new grant, no credential change |
| Git protection of the artifact | `.gitignore` entry added, confirmed with `git check-ignore -v`, and `git status` contains no backup path |
| Secret handling | Connection details passed only through a temporary mode-`0600` `--defaults-extra-file` (not argv, so absent from `ps`), deleted in a `finally` block; nothing printed |

Details recorded as required: **artifact location** (sanitised, relative,
git-ignored); **checksum** (sha256); **restore verification** (schema fingerprint +
journal + per-table row counts equal to production); **table counts** (14 → 14);
**schema comparison** (columns, types, nullability, defaults, indexes and foreign keys
compared as one stabilised fingerprint); **recovery limitations** (Section H.9).
Backup command shape matches the runbook:
`mysqldump --single-transaction --routines --triggers --events --no-tablespaces --databases database-airprod`.
The restore remapped the database name from the dump, which is why the restore proves
recoverability rather than merely re-importing the original name.

**Process notes reported honestly (no failures hidden):** two initial rehearsal runs
failed **inside my own script, not in the application** — once a scoping bug in the
runner, and once because I read `.cashflowId` from `recordGeneralExpense`, which
returns a canonical `Cashflow` (field `.id`). Both were fixed in the runner; the
application code was **not** changed, and the pre-existing `vitest` suite already
covers jobless-expense behaviour. The runner's safety net correctly dropped
`airprod_rehearsal` after each failure.

### H.6. Migration rehearsal evidence (`airprod_rehearsal` only)

`0001` was applied through the **real Drizzle migrator** (`drizzle-orm/mysql2/migrator`
over `drizzle/`), the same path `drizzle-kit migrate` uses in the runbook — not
hand-written SQL.

| # | Check | Result |
| --- | --- | --- |
| P0E2A-10 | `cashflows.job_id` becomes nullable | ✅ `IS_NULLABLE=YES` |
| P0E2A-11 | Both idempotency columns exist | ✅ `idempotency_key`, `idempotency_fingerprint` |
| P0E2A-12 | Expected UNIQUE constraint exists | ✅ `uq_cashflows_idempotency_key` |
| P0E2A-13 | Existing foreign key remains intact | ✅ `cashflows_job_id_jobs_id_fk` |
| P0E2A-14 | Migration journal consistent | ✅ 1 → 2 entries |
| P0E2A-15 | No domain-table row change | ✅ 13 domain tables still 0 rows (journal legitimately +1) |
| P0E2A-16 | Defaults normalised to `0.00` | ✅ `crew`, `job_crews` |
| P0E2A-17 | Journal equals the approved test database | ✅ hashes/ids match `airprod_test` |
| P0E2A-21 | Canonical financial operations work on the migrated schema | ✅ job + schedule + client payment + expense created |
| P0E2A-22 | DB-backed idempotency | ✅ identical replay returned the **same** cashflow id |
| P0E2A-23 | Payment status derived from actual cash | ✅ `PARTIAL` / `450.00` |
| P0E2A-24 | General expense without a job | ✅ stored with `job_id = NULL` |
| P0E2A-25 | Cash ledger row count as expected | ✅ 2 rows (client payment + expense; crew obligation adds none) |

**Repeated-migration safety (mandatory check):**

| # | Check | Result |
| --- | --- | --- |
| P0E2A-18 | Re-running the migrator is idempotent | ✅ journal still 2, schema fingerprint unchanged |
| P0E2A-19 | Re-applying the raw `0001` SQL fails **loudly** rather than corrupting silently | ✅ `ER_DUP_FIELDNAME: Duplicate column name 'idempotency_key'` |
| P0E2A-20 | Schema remains intact after that failed re-apply | ✅ fingerprint unchanged |

Interpretation: the idempotence guarantee comes from the `__drizzle_migrations`
journal, not from the SQL being re-runnable. The first three `0001` statements
(`MODIFY COLUMN …`) are individually idempotent, so a raw re-run applies them again
and then **stops with an error** at `ADD idempotency_key` — it fails closed, and it
leaves the schema valid. `docs/MIGRATION-RUNBOOK.md` A.5's "stop immediately; do not
retry blindly" guidance therefore remains correct.

### H.7. Connection and pooling analysis (D-CONN-1 / D-CONN-2)

**Runtime requirements.** `mysql2` + Drizzle require the **Node.js** runtime; the
project must keep all database access on Node functions (never Edge), which the
current dynamic-route design already enforces. The pool is created lazily, once per
process, cached on `globalThis`, with `connectionLimit: 10`, `maxIdle: 10`,
`idleTimeout: 60 s`, `waitForConnections: true`, `dateStrings: true`, and a per
connection `SET time_zone = '+00:00'`.

**D-CONN-1 — provider options (enumerated from the live service catalog):**

| Option | MySQL/MariaDB? | Compatibility with this schema | Notes |
| --- | --- | --- | --- |
| Keep self-hosted MariaDB (current) | ✅ yes | ✅ full (FKs, CHECKs, `datetime(3)`, `decimal(15,2)`) | Zero migration risk; requires the app host and DB host to stay reachable from Vercel functions (public exposure or tunneling) |
| **Aiven** (managed MySQL) | ✅ yes | ✅ expected full — real MySQL/MariaDB engine | Listed in the catalog; needs `AIVEN_TOKEN`/`AIVEN_PROJECT` for provisioning; TLS + IP allow-list prerequisites |
| **PlanetScale** (MySQL-compatible / Vitess) | ✅ yes | ⚠️ **conditional** | FKs must be **explicitly enabled** per database and are supported **only in unsharded** databases; deploy requests do **not** validate referential integrity of existing rows; reverts can create orphaned rows; modifying a table referenced by FK children can hold a metadata lock while clearing adaptive-hash-index entries (risk for the `crew` / `job_crews` / `cashflows` ALTERs) |
| Neon · Tiger Cloud · Crunchy Bridge · Xata · Timescale · CockroachDB · YugabyteDB | ❌ Postgres | ❌ would require a full engine/driver port | Explicitly **out of scope** — the owner decision is MySQL (Option A), and a port is a different project |
| Turso · Cloudflare D1 | ❌ SQLite/libSQL | ❌ same | Out of scope |

**D-CONN-2 — connection strategy options and risks:**

| Concern | Finding |
| --- | --- |
| Per-instance pools | Vercel runs many concurrent function instances, so worst-case connections ≈ instances × `connectionLimit` (10). Nothing in the app currently caps the number of instances |
| Platform limits | Vercel documents **1,024 file descriptors shared across concurrent invocations** and explicitly advises pooling for database connections; the official guide is `https://vercel.com/kb/guide/connection-pooling-with-functions` |
| Provider caps | Managed tiers impose their own connection ceilings; exceeding them shows up as `ER_CON_COUNT_ERROR` / acquire timeouts, not as app errors |
| Cold starts | Each new instance opens fresh connections; a burst of cold starts multiplies connection demand |
| Options | (a) lower `connectionLimit` per instance; (b) use an **external pooler/proxy** in front of the database; (c) adopt `attachDatabasePool` from `@vercel/functions` (documented for Fluid compute) to release idle pooled connections; (d) serverless/HTTP driver — not available for MySQL here; (e) keep one long-lived DB host and accept the addressable-connection ceiling |
| TLS / network | Managed providers require TLS and often an IP allow-list or private networking; `mysql2` needs an explicit `ssl` configuration, which the current `createDatabaseHandle()` does **not** set |
| Node runtime | Must stay Node.js, not Edge, and the connection string must remain `mysql://` or `mariadb://` (`src/db/env.ts` enforces this) |

**No provider was purchased, provisioned, configured, or changed in this phase.**
D-CONN-1/D-CONN-2 remain owner decisions (Section H.13).

### H.8. GO / NO-GO criteria for P0E-2B

| Gate | Requirement | Current state |
| --- | --- | --- |
| G1 | `npm run build` exits 0 with `GOOGLE_*` unset | ✅ satisfied (P0E-1B, re-verified) |
| G2 | Full suite green; `tsc`/`lint`/`db:check` clean | ✅ 250/250 · 0 · 0 · clean |
| G3 | `0001` verified on a disposable database (schema, UNIQUE, FK, journal, repeat safety) | ✅ satisfied (H.6) |
| G4 | `npm run migration:preflight` clean, baseline re-confirmed | ✅ exit 0, no drift |
| G5 | Backup taken with a recorded checksum | ✅ taken; ⚠️ **on-host only** |
| G6 | Backup stored **off-server** and restorable from there | ❌ **BLOCKED** (H.5) |
| G7 | Restore rehearsal verified against the backup | ✅ on-host rehearsal passed; ❌ not from off-server |
| G8 | Data-volume rehearsal (populated copy) or an explicitly accepted empty-table risk | ❌ not done — production is empty, so behaviour is unmeasured on a populated `cashflows` |
| G9 | Maintenance window, operator and rollback owner named | ❌ unassigned (owner decision) |
| G10 | Written go/no-go approval recorded | ❌ not requested |
| G11 | Runtime activation approved **separately** from the migration | ❌ separate decision, not started |
| G12 | No public exposure before P1A/P1B auth | ✅ nothing deployed or exposed |

**GO is permitted only when G1–G11 are satisfied.** G6 and G8 are the two items a
future phase must close (or the owner must explicitly accept as risk).

### H.9. Rollback limitations

- `0001` has **no down-migration**. Rollback is a **restore from the pre-migration
dump**, not a reverse migration.
- MySQL/MariaDB DDL here is **not transactional**: if an `ALTER` fails midway, the
  statements already applied stay applied. Recovery = restore the dump.
- Because the verified backup is **on the same host** as the database, that recover
does **not** survive host or disk loss — this is the substance of the BLOCKED G6
  criterion, not a documentation gap.
- Restoring overwrites the database: anything written between the dump and the
  failure is lost. The rollout therefore assumes an app write freeze (the app is not
  activated yet, so today that freeze is trivially satisfied).
- `ALTER TABLE … MODIFY COLUMN` on `cashflows`, `crew` and `job_crews` may **rebuild**
  those tables. On an empty database (today) that is instant; the cost is unmeasured
  once rows exist (G8), and a maintenance window is required.
- Rolling back the *application* is separate and cheap: `src/services/runtime.ts` is
  the single composition boundary.
- If a managed provider with Vitess semantics (e.g. PlanetScale) were chosen,
  FK-related DDL carries the extra caveats in H.7 (no referential validation on deploy
  requests; possible orphaned rows on revert).

### H.10. Security and authentication exposure risks

**Explicit conclusion: the application must NOT be deployed publicly before P1A/P1B
and P0E-2B.** Today the app has no authentication or authorization at all:

| Risk | Detail |
| --- | --- |
| No login | No auth implementation exists (P1A/P1B). Every route is reachable by anyone who can reach the deployment |
| Unauthenticated write surface | All Server Actions in `src/app/actions/**` are unauthenticated write endpoints, including financial recording (`recordClientPaymentAction`, `recordVendorPaymentAction`, `recordExpenseAction`) |
| Placeholder identity | The shell renders a static `Admin` label. It is **not** authorization, and no fake admin account exists — `admins`/`sessions` are read-only display data |
| Single privileged credential | One `DATABASE_URL` account covers app DML and DDL/dumps; there is no least-privilege app user (B-18) |
| Transport | Managed providers require TLS, and `createDatabaseHandle()` does not currently configure `ssl`; a public DB endpoint without TLS is unacceptable |
| Exposure of money data | Cashflows, client/vendor schedules and contact data are all readable if the app is exposed |
| Server Actions | They validate input but do not authorize callers; `revalidatePath` is not an access control |

**Mitigations already true:** nothing is deployed or publicly exposed; the build, tests
and rehearsal all ran locally; no credentials were printed; dumps are mode `0600` in a
git-ignored directory. **Required before any public exposure:** P1A/P1B authentication
and authorization, a least-privilege runtime DB account, TLS, and the P0E-2B gate.

### H.11. Verification results with exit codes

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0** |
| `npm run lint` | 0 errors, 0 warnings | **0** |
| `npm run db:check` | `Everything's fine 🐶🔥` | **0** |
| `npx vitest run` | **250 passed / 250** (10 files) | **0** |
| `npm run build` (all `GOOGLE_*` unset) | compiled, type-checked, 4/4 static pages, no `/venues` | **0** |
| `npm run migration:preflight` | read-only production preflight, no drift | **0** |
| `npm run migration:rehearsal` | **26/26 checks**, off-server copy BLOCKED | **0** |

Per file in the suite: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` 46 ·
`migration-snapshot` 39 · `application-foundation` 7 · `application-conversion` 14 ·
**`activation-readiness` 15**. **Inherited failures: none** (the only inherited failure,
the build, was fixed in P0E-1B). **New failures introduced: none.**

### H.12. Production safety proof

- **Production was READ ONLY.** The only operations against `database-airprod` were
  `mysqldump` (a read of the schema + data) and the preflight's
  `SELECT`/`information_schema` queries, whose guards reject any DDL/DML keyword. **No
  INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/TRUNCATE/SEED/RESET ran against production.**
  After the phase, 14 tables remain at 0 rows, the journal is still `0000`,
  `cashflows.job_id` is still NOT NULL, the idempotency columns/UNIQUE are still
  absent, and there is no drift.
- **Rehearsal isolation:** the only database written or dropped was
  `airprod_rehearsal`, which was created for the rehearsal and dropped at the end. A
  post-run check lists only `airprod_test` and `database-airprod` as AirProd schemas.
- **`airprod_test`** was used only by the existing `vitest` harness (which resets it on
  every run — pre-existing behaviour) and was never used as a rehearsal target for
  `0001`; the guards reject it explicitly.
- **Google Sheets:** no access of any kind; no credential requested.
- **Credentials:** never printed. The rehearsal passed them through a temporary mode
  `0600` `--defaults-extra-file` (never argv, so they do not appear in `ps`) and
  deleted it. Dump contents were never printed in this report.
- **Repository:** no commit, push, stash, reset, clean or revert. HEAD is still
  `7c4cc41`; the working tree is preserved — **90** changed/untracked paths, i.e. the
  89 paths carried in from P0A–P0E-1B (unchanged) plus one new file,
  `tests/activation-readiness.test.ts` (this phase's other new files live inside the
  already-untracked `scripts/` and `src/migration-cli/` directories). No existing test
  was deleted or weakened; no legacy or production source file was modified.

### H.13. Outstanding owner decisions

| ID | Decision needed | Why it blocks |
| --- | --- | --- |
| **D-ACT-1** | Written **go/no-go** for the production `0001` rollout (window, operator, rollback owner) | Gate G9/G10 |
| **D-ACT-2** | Written **go/no-go** for production runtime activation — a **separate** decision from D-ACT-1 | Gate G11 |
| **D-BACKUP-1** | Provide/authorize an **off-host** backup destination; re-run the restore rehearsal against it | Gate G6 (currently BLOCKED) |
| **D-DATA-1** | Accept an empty-table rollout, or rehearse against a populated copy | Gate G8 |
| **D-CONN-1** | Database provider (stay self-hosted vs. Aiven vs. PlanetScale) | Deployment planning |
| **D-CONN-2** | Connection/pooling strategy (pool cap, external pooler, `attachDatabasePool`) | Serverless stability |
| **D-SEC-1** | Whether P0E-2B introduces a separate least-privilege runtime DB account | Security posture (B-18) |
| **D-COMMIT-1** | What to commit (90-path working tree, incl. the pre-existing `dotenv` delta) | Nothing committed yet |

### H.14. Updated blocker register

| # | Blocker / decision | Status | Target |
| --- | --- | --- | --- |
| B-1, B-2, B-3, B-4 | Google runtime seam, build failure, consumer conversion, blocked legacy methods | ✅ closed in P0E-1B | — |
| B-5 | `0001` unapplied to production | Open — **gate now specified and rehearsed** | P0E-2B |
| B-6 | Production activation unapproved | Open | P0E-2B |
| B-7 | Provider/pooling undecided | Open — options now enumerated | P0E-2B / P4A |
| B-14 | **Off-server backup destination unavailable** | **Open — BLOCKED criterion** | P0E-2B (mandatory) |
| B-15 | **Rehearsal ran on an empty clone; data-volume behaviour unmeasured** | Open | P0E-2B |
| B-16 | **Window/operator/rollback owner unassigned** | Open | P0E-2B |
| B-17 | Preflight checklist still P0D-named and blind to rehearsal evidence | Open (tooling, optional) | P0E-2B |
| B-18 | **No least-privilege runtime DB account** | Open | P0E-2B |
| B-8 | No authentication/authorization | Open | P1A/P1B |
| B-9 | No automatic job numbering | Open | P2A |
| B-10 | Remaining business-UI depth | Open | P2B–P2E |
| B-11 | No milestone-count increase (5/18 · 5/17) | Informational | — |
| B-12 | 90-path uncommitted delta | Open | owner commit decision |
| B-13 | Converted runtime not exercised in a deployment | Open | P0E-2B / P1A |

### H.15. Updated 18-milestone roadmap

The roadmap is **unchanged**: 5 completed (P0A, P0B, P0C-1, P0C-2, P0C-3), 1 skipped
(P0D — owner decision), 12 remaining (P0E → P4B). P0E is still **IN PROGRESS**:
P0E-1A PASS WITH LIMITATIONS · **P0E-1B PASS** · **P0E-2A PASS WITH LIMITATIONS** ·
P0E-2B NOT STARTED. Subphases are not milestones (Section B).

### H.16. Historical and adjusted progress (explicit denominators)

| Metric | Value | Denominator |
| --- | --- | --- |
| Historical completion | **5 / 18 = 27.8 %** | All 18 original milestones; skipped ≠ completed |
| Skipped by owner decision | **1 / 18** | P0D |
| Remaining | **12 / 18** | P0E → P4B |
| Adjusted active-roadmap completion | **5 / 17 = 29.4 %** | 18 − 1 skipped = **17**; labelled separately, **not** a gain |

**Unchanged by P0E-2A.** A readiness/rehearsal subphase does not complete a milestone.

### H.17. Production readiness checklist — evidence for every item

**Remains 4 / 10** (no point was added, and none removed):

| Item | Ready? | Evidence |
| --- | --- | --- |
| Data model / schema on MySQL | ✅ | 13 domain tables + `job_sequences`; migrations reproducible; **restore rehearsal reproduced the schema fingerprint exactly** (P0E2A-8) |
| Canonical repository contract satisfied | ✅ | 12/12 members, 59/59 methods (P0C-3); re-exercised on the migrated rehearsal schema (P0E2A-21…25) |
| Financial ledger guarantees | ✅ | decimal strings, atomic writes, DB-backed idempotency (**verified on the upgraded schema**), derived status |
| Historical data migrated | ➖ Not required | Owner decision: Fresh Start MySQL |
| Application running on MySQL | ❌ | Source converted (P0E-1B) and `0001` rehearsed (P0E-2A), but production is **not activated** |
| Authentication / authorization | ❌ | P1A / P1B — still absent (H.10) |
| Business features (job numbering, master data, crew payment, finance UI, dashboard) | ❌ | P2A–P2E |
| Automated + E2E UI testing | ❌ | P3B (unit/integration only today) |
| Build green without external credentials | ✅ | `npm run build` exit 0 with `GOOGLE_*` unset (P0E-1B; re-verified) |
| Deployment (Vercel) + final acceptance | ❌ | P4A / P4B — not started; D-CONN-1/D-CONN-2 open |

**No criterion was upgraded on the strength of a plan or a rehearsal alone.**

### H.18. Exact P0E-2B handoff and approval requirements

**PROPOSED — NOT STARTED — NOT AUTHORIZED.** Executing P0E-2B requires a **new,
explicit written owner approval**. Approval of P0E-2A does not carry over, and
production migration, runtime activation and deployment remain **three separate
decisions**.

**Entry requirements (all mandatory before P0E-2B begins)**

1. G1–G5 satisfied — ✅ already true (build, suite, `0001` rehearsal, preflight, on-host backup + checksum).
2. **G6** — an **off-host** backup destination is provided/authorized and the restore rehearsal is re-run against a copy taken **from there**. *(currently BLOCKED)*
3. **G8** — either rehearse against a populated copy, or record the owner's explicit acceptance of the empty-table risk.
4. **G9** — named maintenance window, operator and rollback owner.
5. **G10** — written go/no-go.
6. D-CONN-1/D-CONN-2 decided, or explicitly deferred to P4A while keeping the conservative `mysql2` limits.

**Execution sequence (only after approval)**

1. Confirm the app is idle/not activated; freeze any writes.
2. Re-run `npm run migration:preflight` and capture the baseline (table counts, journal, schema fingerprint).
3. Take the off-host backup; record location + checksum; verify the restore from it.
4. Apply `0001` with the committed journal (`npx drizzle-kit migrate`) — no hand-edited SQL.
5. Run the post-migration verification from `docs/MIGRATION-RUNBOOK.md` A.6 and compare with the baseline: 14 tables, journal now `0001`, nullable `job_id`, both idempotency columns, UNIQUE index, FK intact, defaults `0.00`, row counts and totals unchanged.
6. Only then request the **separate** runtime-activation decision; never inside the migration window without its own approval.

**Rollback (mandatory and rehearsed):** restore the pre-migration dump (there is no
down-migration); DDL is non-transactional, so a mid-way failure means "stop, restore,
retry" — never "retry blindly". Keep the dump until post-migration verification is
signed off.

**Explicitly out of P0E-2B's automatic scope:** deployment/public exposure (P4A/P4B),
authentication (P1A/P1B), job numbering (P2A), UI milestones (P2B–P2E), and any
provider provisioning.

**STOP.** P0E-2A ends here. Await explicit owner approval before any production
migration, activation, deployment, or subsequent phase.

---

## SECTION I — PHASE REPORT: P0E-2A.1 — ACTIVATION GATE HARDENING & LOCAL-PC BACKUP PREPARATION (HISTORICAL, PRESERVED)

### I.1. Objective, exact scope, and verdict

**Objective:** harden the production activation gate, prepare a safe **backup to the
owner's laptop/PC**, verify backup integrity, and make the readiness checklist fail
closed — **without** applying `0001` to production, without activating, deploying or
exposing anything, and without writing to production.

**In scope (executed):** inspect the repository and topology; harden the fail-closed
guards; prepare the local-PC backup workflow (manifest, checksum, transfer
instructions, destination verification); add a fail-closed activation checklist that
closes the P0D-named-checklist gap; least-privilege DB-account analysis; provider /
pooling decision inventory; focused automated tests; full verification; and update
this single report file.

**Out of scope (not done):** production `0001`; any production write; production
activation; public deployment/exposure; authentication (P1A/P1B); job numbering
(P2A); business features; historical Google Sheets migration; production seeding;
installing remote-access software, changing firewall rules, exposing DB ports, or
modifying any remote machine; commit/push/reset/stash/clean/revert.

**Verdict: PASS WITH LIMITATIONS.**

- Every safely executable scope item was completed and verified; all checks pass
  (272/272 tests, `tsc`/`lint`/`db:check`/`build`/`preflight`/rehearsal all green).
- **The chosen destination is NOT OFF-HOST.** The owner selected the **local
  laptop/PC**, and the topology inspection proves the **production DB host is the
  same machine** (`LOOPBACK`). Per the phase rule, the off-host acceptance process is
  **STOPPED** pending a **separate destination decision**. No provider was silently
  substituted and no transfer was invented (Section I.3/I.5).
- Two honest scope boundaries remain owner decisions: the maintenance window /
  operator / rollback owner, and D-CONN-1/D-CONN-2.

### I.2. Verified starting baseline (rechecked, not trusted)

| Item | Prompt's reported baseline | Verified in the repository |
| --- | --- | --- |
| Previous phase | P0E-2A PASS WITH LIMITATIONS | ✅ (Section H) |
| Tests | 250/250, 10 files | ✅ reproduced before any change |
| TypeScript / lint / `db:check` | 0 / 0 / clean | ✅ |
| Build with all `GOOGLE_*` unset | PASS | ✅ reproduced |
| DB preflight | PASS | ✅ exit 0 |
| Migration rehearsal | 26/26 | ✅ reproduced (re-run) |
| Production `0001` | NOT APPLIED | ✅ |
| Production activation | NOT STARTED | ✅ |
| Git HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` | ✅ identical |
| Uncommitted paths | ~90 preserved | ✅ preserved; working tree unchanged except this phase's files |
| Master progress | 5/18 completed · 1 skipped · 12 remaining | ✅ |
| Historical / adjusted progress | 27.8 % / 29.4 % | ✅ |
| Production readiness | 4/10 | ✅ |

### I.3. Topology inspection (no private address/user/password/connection string printed)

| Aspect | Finding (safe to report) |
| --- | --- |
| Production database name | `database-airprod` |
| Engine / version | MariaDB **11.8.8** |
| **DB host class** | **`LOOPBACK` — the same machine as the project workspace** (port 3306) |
| Backend host class | `LOOPBACK` (same machine) |
| Project workspace | a local path under the owner's home directory (absolute home path withheld) |
| Credentials present | yes (username + password present in `DATABASE_URL`) — **never printed** |
| Owner-selected backup destination | **local laptop/PC** |

**Decisive conclusion (per phase §2):** because the production database resides on the
**same laptop/PC** that the owner selected as the backup destination, that destination
is classified **NOT OFF-HOST**. The off-host acceptance process is **STOPPED** pending
a **separate destination decision**. The class was obtained without printing the host
address: `classifyHostFromUrl()` returns only the category (`LOOPBACK`). No IP, host
name, username, password or connection string appears in this report. No remote-access
software was installed, no firewall/port was changed, and no remote machine was
modified.

### I.4. Changed files (this phase)

**Created (3, code/test — the one-file rule applies to reports/docs only)**

| File | Purpose |
| --- | --- |
| `src/migration-cli/activation-checklist.ts` | Fail-closed **activation readiness checklist** (`buildActivationReadinessChecklist`, 21 `P0E2B-*` items) consuming preflight + backup/off-host/restore/approval/runtime evidence; returns `GO`/`NO-GO` + blockers. |
| `scripts/p0e2a1-local-backup.mjs` | Guarded local-PC backup **prepare** (manifest + checksum + safe operator instructions) and **verify** (destination checksum + off-host attestation) workflow. Reuses the P0E-2A guard module. |
| `tests/activation-gates.test.ts` | **22 DB-free tests** for host classification, artifact-path validation, off-host evidence, checksum mismatch, unsafe restore targets, approval gates, secret-leak detection, fail-closed checklist, and tooling compatibility. |

**Modified (3)**

| File | Change |
| --- | --- |
| `src/migration-cli/activation-guards.ts` | Added P0E-2A.1 guards (all pure, fail-closed): `classifyHost`/`classifyHostFromUrl`, `normalizeChecksum`/`isSha256`/`checksumsMatch`/`assertChecksumsMatch`, `isSafeArtifactName`/`assertArtifactPathInsideBackupDir`, `evaluateOffHostEvidence`/`assertOffHostConfirmed`, `validateBackupManifest`/`assertBackupManifestValid`, `validateActivationApprovals`/`assertActivationApprovals`, `findSecretLeaks`/`assertNoSecretLeak`, `deriveBackupAcceptanceState`. **No existing export changed.** |
| `package.json` | Added `migration:backup:local` (P0E-2A.1). The file already carried the pre-existing `dotenv` delta. |
| `docs/PROJECT-PROGRESS.md` | This section + dashboard/roadmap/log/blocker/readiness/handoff updates. |

**Runtime artefacts (not source, git-ignored):** `.migration-backups/*.sql`, the new
`*.manifest.json`, and the re-run rehearsal artifact under `.migration-backups/`.
**No existing test was deleted, skipped or weakened; no production or legacy source
file was modified.**

### I.5. Backup & off-host acceptance — four separate conditions

Per phase §5 these are **four distinct acceptance conditions**. A checksum match alone
is **not** a successful restore.

| # | Condition | Status | Evidence |
| --- | --- | --- | --- |
| 1 | **Local backup created** | ✅ **DONE** | Read-only `mysqldump` of `database-airprod` (14 tables, all 0 rows), sha256 `c0f4b6ed…`, 18 708 bytes, mode `0600`, git-ignored. Re-run rehearsal also produced a second identical artifact. |
| 2 | **Backup transferred to another host** | ❌ **NOT DONE** | Owner chose the local laptop/PC — the **same machine** as the DB host. No off-host destination exists or was authorized. |
| 3 | **Destination checksum verified** | ❌ **NOT DONE** | No destination copy exists. The verifier's mechanics were exercised only in a throwaway temp dir; the fabricated evidence record was **deleted**, so no false off-host claim exists. |
| 4 | **Off-host restore successfully rehearsed** | ❌ **NOT DONE (BLOCKED)** | The P0E-2A on-host rehearsal passed 26/26, but there is no off-host copy to restore from. |

**Local-PC backup workflow prepared** (`npm run migration:backup:local`):

- `prepare` — requires the backup source to be `database-airprod`; reuses an existing
  artifact (or `--fresh` for a guarded read-only `mysqldump`); verifies the archive dir
  is git-ignored; writes a JSON **manifest** (`p0e2a1-backup-manifest/1`: database,
  artifact name, bytes, sha256, created-at, mode, git-ignore flag) at mode `0600`; and
  prints **safe operator transfer instructions** (source path sanitised, checksum, a
  destination that must be a different machine, and the exact verify command).
  Credentials are never placed in argv, are read only via a temporary mode-`0600`
  `--defaults-extra-file`, and are never printed (enforced by `assertNoSecretLeak`).
- `verify --dir=<dir> --separate-machine` — recomputes the destination sha256, refuses
  any mismatch (`assertChecksumsMatch`), refuses to claim off-host without the explicit
  `--separate-machine` attestation, and writes a git-ignored `off-host-evidence.json`.

**Mechanics verified with real commands** (temp copy, then removed): without
`--separate-machine` → `NOT_OFF_HOST`, exit **3**; corrupted copy → checksum rejected,
exit **1**; correct copy + `--separate-machine` → `CONFIRMED_OFF_HOST`, exit **0**.
The remotely-transfer step itself is **owner-initiated** (USB drive / existing SFTP /
encrypted copy) — the agent has no access to the owner's laptop and does **not** invent
a transfer.

### I.6. Activation gate hardening (fail-closed)

The new guards make an unsafe activation **structurally impossible**, and the new
checklist forces **NO-GO** whenever mandatory evidence is missing:

| Guard | What it enforces |
| --- | --- |
| `assertBackupSourceAllowed` / `assertRehearsalTargetAllowed` / `assertDestructiveTargetAllowed` | (P0E-2A, reused) only production may be a backup source; only `airprod_rehearsal` may be written/dropped |
| `assertChecksumsMatch` | missing **or** mismatched sha256 always throws |
| `assertArtifactPathInsideBackupDir` / `isSafeArtifactName` | artifacts must be safe-named and inside the project backup dir |
| `evaluateOffHostEvidence` / `assertOffHostConfirmed` | `NOT_OFF_HOST` and `UNVERIFIED` both stop the process with distinct messages |
| `validateBackupManifest` / `assertBackupManifestValid` | manifest must name production, a safe artifact, a valid sha256/size and the git-ignore confirmation |
| `validateActivationApprovals` / `assertActivationApprovals` | migration and activation are two approvals, each requiring a written reference |
| `findSecretLeaks` / `assertNoSecretLeak` | printed/committed text must not contain credential values |
| `deriveBackupAcceptanceState` | a checksum match alone never advances past `DESTINATION_CHECKSUM_VERIFIED` |

### I.7. Production preflight checklist improvement (B-17 closed)

The legacy `buildP0D2BReadinessChecklist` (P0D-named, blind to rehearsal evidence, and
reporting `P0D2B-7` as unverifiable) is **retained** for historical tooling and its
existing test. In its place, the new **`buildActivationReadinessChecklist`** explicitly
checks or records every required item and **fails closed** when evidence is absent:

| Item group | `P0E2B-*` |
| --- | --- |
| Production identity / journal / drift / `0001` baseline | 1, 2, 3, 4 |
| Backup availability / manifest / sha256 | 5, 6, 7 |
| Off-host: transferred / destination checksum / off-host evidence / restore-from-off-host | 8, 9, 10, 11 |
| Restore rehearsal: disposable target / schema / journal+rows | 12, 13, 14 |
| Maintenance window / named operator / named rollback owner | 15, 16, 17 |
| Separate migration & activation approvals | 18, 19 |
| Runtime DB permissions (least privilege) / public-exposure & auth restriction | 20, 21 |

Verdict is `GO` only when **all 21** items are satisfied; otherwise `NO-GO` with an
explicit blocker list. Tests prove that empty evidence → `NO-GO`, a checksum mismatch →
`NO-GO`, a shared-test restore target → `NO-GO`, and a journal already at `0001` →
`NO-GO`. No `PASS` is fabricated.

### I.8. Least-privilege database-account analysis (no grant/user change made)

Inspected the actual runtime SQL: the canonical repositories (`src/repositories/mysql/**`)
issue **only DML** — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, wrapped in transactions —
across the 13 domain tables plus `admins`/`sessions`. **No DDL is executed at runtime.**

| Role | Minimum privileges | Notes |
| --- | --- | --- |
| **Application runtime** | `SELECT, INSERT, UPDATE, DELETE` on the 13 domain tables + `admins`, `sessions` | No `ALTER`/`CREATE`/`DROP`, no `GRANT`, no file/`SUPER`; only the Node runtime (never Edge) |
| **Backup operator** | `SELECT, LOCK TABLES` (and `RELOAD` if needed) | `mysqldump --single-transaction` reads without blocking; `--routines/--triggers/--events` may require additional read privileges |
| **Migration operator** | `ALTER, CREATE, DROP, INDEX` + `INSERT` on `__drizzle_migrations` | Runs `drizzle-kit migrate`; the only role that performs DDL |
| **Restore-rehearsal operator** | `CREATE`/`DROP` on the disposable schema + DML | Strictly limited to `airprod_rehearsal` by the guards |

**Separation of responsibilities:** today a **single** `DATABASE_URL` account holds all
of these (B-18). The recommended separation for P0E-2B is a **DML-only app account**, a
**DDL migration account**, and a **backup/restore account**, so a leaked app credential
cannot alter schemas. **No user was created, no grant changed, no credential rotated,
and no production access altered** — that needs separate explicit approval.

### I.9. Connection & deployment readiness (D-CONN-1 / D-CONN-2)

Unchanged from Section H.7, re-confirmed:

- **Runtime requirements:** `mysql2` + Drizzle on the **Node.js** runtime (not Edge); a
  lazy per-process pool (`globalThis`-cached) with `connectionLimit: 10`, `maxIdle: 10`,
  `idleTimeout: 60 s`, `waitForConnections: true`, `dateStrings: true`, and per-connection
  `SET time_zone = '+00:00'`. `createDatabaseHandle()` does **not** configure TLS.
- **D-CONN-1 (provider) inventory (live catalog):** **Aiven** (managed MySQL among its
  open-source services) and **PlanetScale** (MySQL-compatible / Vitess) are listed. A
  semantic provider search returned no *recommendation* (it reasoned none of the
  catalog's current candidates match a MySQL+FK requirement well), which is consistent
  with keeping self-hosted MariaDB as the zero-migration-risk default. PostgreSQL and
  SQLite/libSQL options are **out of scope** (owner decision is MySQL). **No provider
  was selected or purchased on the owner's behalf.**
- **D-CONN-2 (pooling) inventory:** per-instance pools risk ≈ instances × 10 connections;
  Vercel documents 1,024 file descriptors shared across invocations and advises pooling.
  Options: cap `connectionLimit`, use an external pooler/proxy, adopt
  `attachDatabasePool` from `@vercel/functions` (Fluid compute), or accept the ceiling.
  No file descriptor, pool cap, or deployment setting was changed.

### I.10. Security gate (unchanged)

Authentication/authorization are **not implemented** (P1A/P1B). The application must
**not** be exposed publicly: every Server Action is an unauthenticated write endpoint
including financial recording, the shell `Admin` label is **not** authentication, and
one privileged credential covers DML + DDL + dumps. **Public activation remains
BLOCKED** until P1A/P1B security acceptance is satisfied; this phase only **audits**
the exposure (checklist item `P0E2B-21`) and implements none of the auth milestones.

### I.11. Verification results with exit codes

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0** |
| `npm run lint` | 0 errors, 0 warnings | **0** |
| `npm run db:check` | `Everything's fine 🐶🔥` | **0** |
| `npx vitest run` | **272 passed / 272** (11 files) | **0** |
| `npm run build` (all `GOOGLE_*` unset) | compiled, type-checked, 4/4 static pages, no `/venues` | **0** |
| `npm run migration:preflight` | read-only production preflight, no drift | **0** |
| `npm run migration:rehearsal` | **26/26 checks** (re-run) | **0** |
| `npm run migration:backup:local -- prepare` | manifest + instructions emitted | **0** |
| `… -- verify` (no `--separate-machine`) | `NOT_OFF_HOST` (blocked) | **3** |
| `… -- verify` (corrupted copy) | checksum rejected | **1** |
| `… -- verify --separate-machine` (temp copy) | `CONFIRMED_OFF_HOST` (mechanics only; evidence removed) | **0** |

Per file in the suite: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` 46 ·
`migration-snapshot` 39 · `application-foundation` 7 · `application-conversion` 14 ·
`activation-readiness` 15 · **`activation-gates` 22**. **Inherited or new failures: none.**

### I.12. Production safety proof

- **Production was READ ONLY.** No INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/TRUNCATE/SEED/
  RESET ran against `database-airprod`. The only reads were `mysqldump` and the
  preflight's `SELECT`/`information_schema` (guarded against DDL/DML keywords).
  Post-phase: 14 tables at 0 rows, journal `0000`, `job_id` still NOT NULL, idempotency
  columns/UNIQUE still absent, no drift.
- **Rehearsal isolation:** the only database written/dropped was the disposable
  `airprod_rehearsal`; `airprod_test` was never a rehearsal target.
- **No backup artifact was deleted or overwritten** — the rehearsal created a new
  artifact beside the existing P0E-2A one (both sha256 `c0f4b6ed…`).
- **Credentials never printed;** the local-backup workflow passes them only via a
  temporary mode-`0600` file and asserts no secret leak in the printed text. The
  fabricated off-host evidence from mechanics testing was **deleted**.
- **Google Sheets / remote machines:** no access of any kind; no remote-access software,
  firewall or DB-port change; no remote machine modified.
- **Repository:** no commit/push/stash/reset/clean/revert; HEAD is still `7c4cc41`; all
  prior uncommitted work preserved.

### I.13. Owner decisions still required

| ID | Decision | Status |
| --- | --- | --- |
| **D-BACKUP-1** | **A separate backup destination** (a genuinely different machine/device) — the local laptop/PC is the same machine as the DB host | **REQUIRED — STOP** |
| **D-ACT-1** | Written go/no-go for the production `0001` rollout (window, operator, rollback owner) | open |
| **D-ACT-2** | Written go/no-go for runtime activation (separate from D-ACT-1) | open |
| **D-DATA-1** | Accept an empty-table rollout, or rehearse against a populated copy | open |
| **D-CONN-1** | Database provider (self-hosted vs Aiven vs PlanetScale) | open |
| **D-CONN-2** | Connection/pooling strategy | open |
| **D-SEC-1** | Whether P0E-2B introduces separate least-privilege DB accounts | open |
| **D-COMMIT-1** | What to commit (the uncommitted working tree incl. the `dotenv` delta) | open |

### I.14. Updated blocker register

| # | Blocker / decision | Status | Target |
| --- | --- | --- | --- |
| B-1…B-4 | Google seam, build failure, consumer conversion, legacy blocked methods | ✅ closed (P0E-1B) | — |
| B-5 | `0001` unapplied to production | Open — gate hardened | P0E-2B |
| B-6 | Production activation unapproved | Open | P0E-2B |
| B-7 | Provider/pooling undecided | Open — inventoried | P0E-2B / P4A |
| B-14 | **Backup destination NOT OFF-HOST** (owner chose the same machine) | **Open — STOP** | separate destination decision |
| B-15 | Rehearsal ran on an empty clone | Open | P0E-2B |
| B-16 | Window/operator/rollback owner unassigned | Open | P0E-2B |
| B-17 | Preflight checklist blind to rehearsal evidence | ✅ **ADDRESSED** (new fail-closed checklist) | closed |
| B-18 | No least-privilege runtime DB account | Open — roles documented | P0E-2B |
| B-8/B-9/B-10 | Auth · job numbering · remaining business UI | Open | P1A–P2E |
| B-11 | No milestone-count increase (5/18 · 5/17) | Informational | — |
| B-12 | Uncommitted working-tree delta | Open | owner commit decision |
| B-13 | Converted runtime not exercised in a deployment | Open | P0E-2B / P1A |

### I.15. Roadmap and progress

The 18-milestone roadmap is **unchanged**: **5 completed** (P0A, P0B, P0C-1, P0C-2,
P0C-3) · **1 skipped** (P0D — owner decision) · **12 remaining** (P0E → P4B).
**Historical completion 5/18 = 27.8 %**; **adjusted active-roadmap 5/17 = 29.4 %**
(denominator excludes the skipped milestone; labelled separately, **not** a gain).
**P0E remains IN PROGRESS** — P0E-1A PASS WITH LIMITATIONS · P0E-1B PASS ·
P0E-2A PASS WITH LIMITATIONS (historical) · **P0E-2A.1 PASS WITH LIMITATIONS** ·
P0E-2B NOT STARTED. Subphases are not milestones, so passing P0E-2A.1 changes no count.

### I.16. Production readiness — **4 / 10** (unchanged)

No point was added or removed: hardened guards, a rehearsed plan and a fail-closed
checklist are **preparation**, not a satisfied readiness criterion. “Application running
on MySQL” stays ❌ (production not activated) and “Deployment (Vercel) + final
acceptance” stays ❌. The only criterion that has ever moved is “build green without
external credentials” (P0E-1B, re-verified here).

### I.17. Exact P0E-2B handoff and approval requirements

**PROPOSED — NOT STARTED — NOT AUTHORIZED.** A **new, explicit written owner approval**
is required. Approval of P0E-2A.1 does **not** carry over; production migration, runtime
activation and deployment remain **three separate decisions**.

**Entry requirements (all mandatory before P0E-2B begins)**

1. G1–G5 satisfied — ✅ already true (build, suite, `0001` rehearsal, preflight, on-host backup + checksum).
2. **G6 — an off-host backup destination provided/authorized** and the restore re-run from a copy taken **there**. ❌ **BLOCKED** — owner chose the same machine as the DB host.
3. **G8 —** rehearse against a populated copy, **or** record the owner's explicit acceptance of the empty-table risk.
4. **G9 —** named maintenance window, operator and rollback owner.
5. **G10 —** written go/no-go.
6. D-CONN-1/D-CONN-2 decided, or explicitly deferred to P4A keeping conservative `mysql2` limits.

The new **activation checklist** (`buildActivationReadinessChecklist`) is the tool that
must report `GO`: today it reports **`NO-GO`** because the off-host, window/operator/
rollback-owner and approval items are unsatisfied. **Execution sequence** (only after
approval) and the **rollback** rule (restore the pre-migration dump — `0001` has no
down-migration) are as in Section H.18, gated by the hardened checklist.

**Explicitly out of P0E-2B's automatic scope:** deployment/public exposure (P4A/P4B),
authentication (P1A/P1B), job numbering (P2A), UI milestones (P2B–P2E), provider
provisioning, and any remote-access/firewall change.

**STOP.** P0E-2A.1 ends here. The off-host acceptance process is **STOPPED** pending a
**separate destination decision**; do **not** start P0E-2B, apply `0001`, activate,
deploy or expose the application until a new written owner go/no-go is given.

---
## SECTION J — P0E-DEV-1 SUMMARY (DETAILED REPORT IN A SEPARATE FILE)

> **Reporting-policy change (effective from P0E-DEV-1 onward):** each phase now has its
> **own** detailed Markdown report. This file (`docs/PROJECT-PROGRESS.md`) is the **master
> dashboard and report index**, not a container for a full phase report. The complete
> P0E-DEV-1 report — every piece of evidence, exit code, route and flow — is at
> **[`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md)**.
> This section is only the concise summary. Sections A–I above are historical and were
> preserved verbatim.

**Verdict: PASS.** P0E-DEV-1 made the existing application usable in **local
development** against MariaDB. A dedicated development database **`airprod_dev`** was
created (it did not exist before) and the existing Drizzle migrations `0000`+`0001` were
applied to it **only**; `.env` now points the application at `airprod_dev` while the test
tooling keeps deriving `airprod_test` (and `database-airprod` stays protected). Two
defects were reproduced, root-caused, fixed and regression-tested:

1. the **test-DB guard** aborted the whole suite when the app was pointed at `airprod_dev`;
2. **Next 16 blocked dev resources** for the `127.0.0.1` origin (font `403`, HMR WebSocket
   failure, incomplete hydration) — fixed via `allowedDevOrigins` in `next.config.ts`.

**Checks (exit codes):** `npx tsc --noEmit` **0** · `npm run lint` **0 errors, 0 warnings** ·
`npm run db:check` clean **0** · `npx vitest run` **278/278** (12 files) · `npm run build`
exit **0** with `GOOGLE_*` unset. **Real browser E2E** covered 9 endpoints (`/`,
`/dashboard`, `/jobs`, `/jobs/JOB-001`, `/clients`, `/vendors`, `/crew`, `/finance`,
unknown→404) and scenarios A–L (master data, manual-number job, crew obligation + cash,
client/vendor schedules, **derived** statuses, delivery, **jobless** expense, duplicate-key
error path, refresh persistence, navigation).

**Database safety:** `airprod_dev` holds the local smoke-test data; `airprod_test` and
`database-airprod` show **0 data rows** (production journal still `0000` only, `0001`
unapplied). Production was **untouched** — no migration, deployment, activation or public
exposure; no commit/push.

**Progress (unchanged):** milestones **5/18 = 27.8 %** · skipped **1** · remaining **12** ·
adjusted **5/17 = 29.4 %** · production readiness **4/10**. P0E-DEV-1 is a subphase of P0E,
not a master milestone. **P0E IN PROGRESS**; next is **P0E-2B, NOT STARTED,
approval-gated**.

**Local startup (verified):** `npm run dev` → `http://localhost:3000` (this environment
used `PORT=3001` because port 3000 was busy); tests: `npx vitest run`. Full instructions
and evidence:
**[`docs/reports/P0E-DEV-1-local-runtime-stabilization.md`](reports/P0E-DEV-1-local-runtime-stabilization.md)**.
