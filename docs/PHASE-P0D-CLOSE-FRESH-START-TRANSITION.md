# PHASE P0D-CLOSE — FRESH START MYSQL ROADMAP TRANSITION

**Verdict: PASS** (documentation + code inspection + strictly read-only verification).
This phase is **not** a technical milestone: it changes the roadmap, not the
application. **Historical completion stays 5/18 (27.8 %)** and **production
readiness stays 3/10**.

**Scope executed:** P0D-CLOSE only. **P0E was not started.** No commit, push,
deploy, reset, clean, stash, revert, or discard. No production migration,
no runtime switch, no data deletion, no seeding, no destructive operation.

---

## 1. Owner decision and exact scope

**OPTION A — FRESH START MYSQL** (authoritative). Historical Google Sheets data is
**not required** and **must not be migrated**; MySQL/MariaDB is the intended sole
active runtime database; Google Sheets is a legacy implementation to be retired in
a later, separately approved phase. This supersedes the historical migration
objective of P0D and the source-access requirements of P0D-2A.

Explicitly **not** authorised by the decision (verified none occurred): deleting
historical data, deleting any Google Sheets spreadsheet, dropping/truncating/
resetting any database, applying production migrations, switching the runtime, or
deploying. "Fresh Start" means **no historical import is required**; it is not a
licence for destructive operations. Any such action needs a **new, explicit owner
approval naming its exact scope**.

**Phase scope:** revise the roadmap, retire the historical migration requirement
from the active path (documents archived, not deleted), audit MySQL Fresh Start
readiness read-only, design P0E-1, update the tracker, run non-destructive checks.

## 2. Baseline branch/HEAD and working-tree safety

| Item | Value |
| --- | --- |
| Branch / HEAD | `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` (unchanged all phase) |
| Working tree | **53 changed paths** (22 modified tracked files + 31 untracked) — all P0A→P0D-2A work preserved |
| Reset / stash / clean / revert / discard | **None** |
| Commit / push / deploy | **None** (HEAD subject still `fix: restore job actions and update database foundation`) |
| Database writes | **None** — only SELECT/`information_schema` reads (see §14) |
| Google Sheets access | **None** — no read, no write, no credential request |

Re-verified rather than trusted: branch, HEAD, working-tree contents, test count,
typecheck, lint, `db:check`, build, production schema/journal/row counts (all
listed in §13 and §6).

## 3. Files created and modified

Created:

| File | Purpose |
| --- | --- |
| `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md` | This phase report (17 sections) |
| `docs/FRESH-START-MYSQL-PLAN.md` | Fresh Start target architecture, audited gap analysis (G1–G12), Vercel connectivity considerations, **P0E-1 plan** |

Modified (documentation only — **no source code, schema, migration, test, or configuration was changed**):

| File | Change |
| --- | --- |
| `docs/PROJECT-PROGRESS.md` | Revised roadmap with a Classification column; owner decision; completed/skipped/remaining counts; historical vs adjusted progress denominators; updated status, DB status, blockers, readiness note, history log, phase reports, next action; new mandatory phase-scope rule |
| `docs/PHASE-P0D1-MIGRATION-PLANNING.md` | ARCHIVED banner (historical verdict preserved unchanged) |
| `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` | ARCHIVED banner (BLOCKED verdict preserved unchanged) |
| `docs/MIGRATION-RECONCILIATION.md` | ARCHIVED banner (not active for new data) |
| `docs/MIGRATION-MAPPING.md` | ARCHIVED banner |
| `docs/MIGRATION-RUNBOOK.md` | Banner: Part B (historical import) cancelled; **Part A (`0001` schema rollout) still relevant** for the canonical financial services, now under a separate P0E-2 approval |
| `docs/MIGRATION-DECISION-REGISTER.md` | Banner: D1–D12 are historical-import gates only, not Fresh Start prerequisites |
| `docs/MIGRATION-SNAPSHOT-INVENTORY.md` | Banner: historical inventory archived; tooling retained |

No historical evidence was rewritten or erased; all prior verdicts stand verbatim.

## 4. Historical migration cancellation status

| Item | Status |
| --- | --- |
| P0D-1 — Migration Planning & Reconciliation | **PASS WITH LIMITATIONS** — preserved as a historical subphase result |
| P0D-2A — Real source snapshot & reconciliation gate | **BLOCKED ON SOURCE ACCESS** — preserved as the historical result |
| P0D-2B — Approved historical import | **CANCELLED / NOT REQUIRED** (owner decision) |
| **P0D parent milestone** | **SKIPPED — OWNER DECISION: FRESH START MYSQL** (not counted as completed) |
| Migration implementation & documents | **ARCHIVED**, not deleted; not on the runtime path (test-enforced) |
| D1–D12 decision register | **ARCHIVED** as historical-import gates; must never be applied to new MySQL data |
| Historical import requirement | **Retired** — no historical row is to be migrated |

Requirements no longer prerequisites for the selected path (documented as retired
in `docs/PROJECT-PROGRESS.md` §5 item 4, §5 item 8, §5 item 9 and the banners):
`GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, the
historical snapshot, the row-count inventory, venue-archive approval, crew-role
dictionary approval, payment reconciliation, source-ID collision checks, the
historical import approval, and D1–D12.

Business requirements still applicable **to new data** are tracked independently in
`docs/FRESH-START-MYSQL-PLAN.md` §2: crew roles (B1), financial ledger integrity
(B2), job-number generation (B3), authentication/authorization (B4), venue removal
from the active UI (B5), client form structure (B6), Vercel-compatible database
connectivity (B7).

## 5. Revised 18-milestone roadmap

Original roadmap retained for traceability; a Classification column was added.
Full table: `docs/PROJECT-PROGRESS.md` §1.

| Classification | Count | Milestones |
| --- | --- | --- |
| ✅ Completed (technical) | **5** | P0A, P0B, P0C-1, P0C-2, P0C-3 (all PASS WITH LIMITATIONS, verdicts preserved) |
| ⏭️ Skipped — owner decision | **1** | P0D (historical data migration; P0-2B cancelled) |
| ⏳ Remaining | **12** | P0E (next), P1A, P1B, P2A, P2B, P2C, P2D, P2E, P3A, P3B, P4A, P4B |

| Metric | Value | Denominator |
| --- | --- | --- |
| **Historical completion** | **5 / 18 = 27.8 %** | All 18 original milestones; only completed ones count — **unchanged**; a skipped milestone is **not** completed |
| Skipped by owner decision | 1 / 18 | P0D |
| Remaining to acceptance | 12 / 18 | P0E → P4B |
| **Adjusted active-roadmap completion** | **5 / 17 = 29.4 %** | **18 − 1 skipped = 17**; labelled separately, and **not** a progress gain (same 5 milestones re-based) |

**P0E is NEXT, NOT STARTED and APPROVAL-GATED.** Its first subphase is P0E-1
(preparation); production activation is the separately gated P0E-2.

## 6. Actual MySQL database preflight (read-only)

Executed with `npm run migration:preflight` (SELECT / `information_schema` only;
`assertReadOnlyQuery` rejects any DDL/DML keyword; the run is restricted to
`database-airprod`). Exit code **0**.

| Check | Result |
| --- | --- |
| Database | `database-airprod` |
| Tables | **14** — `admins, cashflows, clients, client_payments, crew, crew_roles, deliveries, jobs, job_crews, job_sequences, sessions, vendors, vendor_payments, __drizzle_migrations` |
| Row counts (E, SELECT-only) | **all 14 tables = 0** (`__drizzle_migrations` has its 1 journal row) |
| Applied migration journal | **1 row = `0000` only** → `0001` **not applied** |
| `cashflows.job_id` | `IS_NULLABLE = NO` |
| Idempotency columns | **absent** (`idempotency_key`, `idempotency_fingerprint`) |
| UNIQUE on `idempotency_key` | **absent** |
| FK on `cashflows` | `cashflows_job_id_jobs_id_fk: job_id → jobs.id` (intact) |
| Defaults | `crew.default_payment = 0.00`, `job_crews.agreed_amount = 0.00` |
| Schema drift | **none detected** |
| Writes performed | **none** |

The empty database is **not** treated as permission to reset or overwrite it.

## 7. Active Google Sheets dependencies

`getRepositories()` (`src/repositories/index.ts`) still returns
`googleRepositories`, so the Google Sheets path is the **required runtime path**:

| Dependency | File(s) | Impact |
| --- | --- | --- |
| Credential loader / auth | `src/lib/google-sheets/client.ts` | throws unless `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` are set |
| Google repositories | `src/repositories/google/index.ts`, `src/repositories/google/mapping.ts` | the active data layer |
| Legacy services | `src/services/master-service.ts`, `src/services/job-service.ts`, `src/services/dashboard-service.ts` | read/write through `getRepositories()` |
| **Root layout (build-time read)** | `src/app/layout.tsx` → `getCurrentAdmin()` → master-service | **every route** fails at prerender without credentials |
| Pages (build-time reads) | `src/app/{dashboard,jobs,jobs/[jobNumber],clients,vendors,crew,venues,finance}/page.tsx` | 8 data-reading routes; **no page declares `dynamic`/`revalidate`** |
| Server Actions | `src/app/actions/{master-actions,job-actions,job-detail-actions,finance-actions}.ts` | write path; `job-detail-actions.ts` imports `getRepositories()` directly |
| Archived migration tooling | `src/migration/**`, `src/migration-cli/**` | **not** part of the application import graph (already enforced by a recursive test); retained as archived work |

Verified: **no** application page, action, component, or legacy service imports
`src/services/canonical/**`, `createMySqlApplication`, `@/repositories/mysql`, or
`@/repositories/contract`. The only app-side MySQL touchpoint is
`src/services/finance-service.ts` (canonical financial service), which nothing
wires up yet.

## 8. Canonical MySQL activation readiness

| Aspect | Status |
| --- | --- |
| Contract v2 completeness | **12/12 members, 59/59 methods** (P0C-3) |
| Canonical factory | `createCanonicalMySqlRepositories()` — connection-injectable |
| Canonical bootstrap | `createMySqlApplication()` → `{ repositories, financial, services }`, testable in isolation |
| Canonical services | `master`, `jobs`, `deliveries`, `adminSessions`, `financial` |
| Wired into the application | **No** (verified by grep — zero app imports) |
| Legacy-contract MySQL adapter | `mysqlRepositories: DataRepositories` exists but **19 method bodies are explicitly blocked** (venues, expenses, client/vendor payment writes) because the canonical schema has no `venues`/`expenses` tables |
| Ready to activate as-is? | **No** |

Activation therefore requires **rewiring the application to Contract v2** and
resolving the UI gaps (venue removal, cashflow-based finance, derived payment
status, `crew_roles`) — with planned feature changes, never with fake adapters
that resurrect legacy entities.

**Audit item J — does any current business logic assume historical records exist?
No (verified).** Services operate safely on an empty dataset: list readers return
empty arrays (pages render their empty states), `getCurrentAdmin()` returns `null`
and the layout falls back to `"Admin"`, job-number uniqueness is checked against the
current `jobs` table only (`assertUniqueJobNumber`), and financial/dashboard
aggregates are computed from whatever rows exist. Independent corroboration: the
full **214-test** suite passes against a database created purely by migrations with
**zero data rows**, and the inventory/dashboard/finance paths were designed for the
empty-state case. Fresh Start therefore needs **no** historical rows to function —
and an empty database is still **not** permission to reset it.

## 9. Migration `0001` status and approval requirements

**Status: exists on disk, NOT applied to `database-airprod`** (journal = `0000`).
Contents: `cashflows.job_id` → nullable; two `DEFAULT '0.00'` normalisations;
`idempotency_key varchar(190)` + `idempotency_fingerprint char(64)` + UNIQUE on
`idempotency_key`. Additive and non-destructive.

**Is `0001` required before enabling the canonical MySQL financial services?**
**YES — it is a hard precondition.** Evidence: the canonical cashflow repository
inserts `idempotencyKey` and `idempotencyFingerprint` on every row and accepts
`jobId: null` (`src/repositories/mysql/finance/cashflows.ts`), and the schema
declares those columns plus `uniqueIndex("uq_cashflows_idempotency_key")`
(`src/db/schema/cashflows.ts`) — all of which arrive only with `0001`. Without it,
cashflow/expense writes fail and jobless operational expenses cannot be stored.

**Approval requirements:** applying `0001` to production needs a **new, written
owner approval** naming the maintenance window, responsible operator, backup
location and go/no-go, plus a rehearsed backup/restore — per
`docs/MIGRATION-RUNBOOK.md` Part A. In P0E-1 it must be applied to
**`airprod_test` first**; production application remains behind the separate
P0E-2 gate. **No approval has been given; `0001` remains unapplied.**

## 10. Fresh Start architecture

Documented in `docs/FRESH-START-MYSQL-PLAN.md` §4: browser → Next.js App Router
(server components + Server Actions) → canonical services
(`master`/`jobs`/`deliveries`/`adminSessions` + canonical financial service) →
Contract v2 repositories → MySQL/MariaDB via Drizzle + `mysql2` (`src/db/**`) as
the sole runtime database. Guiding rules: one runtime provider; **no fake adapters**;
Contract v2 is the source of truth; legacy services are replaced (not forked);
archived migration tooling never enters the runtime path.

## 11. Proposed P0E-1 scope

**P0E-1 — MySQL Runtime Activation Preparation. NOT STARTED; approval-gated; not
implemented by P0D-CLOSE.** Full plan: `docs/FRESH-START-MYSQL-PLAN.md` §7
(tasks P0E-1.1 … P0E-1.14). Summary:

- wire the runtime provider to canonical MySQL repositories through the single
  `getRepositories()` seam;
- replace legacy services used by pages/actions with canonical services;
- resolve, by **planned feature changes**, the venue (no entity → remove from active
  UI), expense (→ `cashflows`), stored-payment-status (→ derived) and crew-role
  (→ `crew_roles`) incompatibilities;
- eliminate the inherited Google Sheets **prerender** dependency (dynamic rendering
  where appropriate) so `npm run build` succeeds with no Google credentials;
- document the environment-variable contract (names only: `DATABASE_URL`; Google
  variables become optional and are archived-tooling-only);
- treat `0001` as a precondition: apply to **`airprod_test` first**, with backup +
  restore rehearsal and rollback plan; production stays behind the P0E-2 gate;
- validate against the isolated test database (`airprod_test` never used as production);
- acceptance: `tsc` 0 errors, `lint` 0 errors, `db:check` clean, full suite green
  with no weakened tests, **`npm run build` exit 0 without Google credentials**;
- explicit production activation gate (P0E-2) and Vercel connectivity decision.

**Not in P0E-1:** production activation, authentication/authorization (P1A/P1B),
job-number generation (P2A), crew-role master UI (P2B), finance UI (P2D),
dashboard/delivery (P2E), UI finalisation (P3A), E2E (P3B), Vercel config (P4A),
deployment (P4B).

## 12. Test results before and after

| | Files | Tests | Changed in this phase |
| --- | --- | --- | --- |
| Before P0D-CLOSE | 7 | **214 / 214** | — |
| After P0D-CLOSE | 7 | **214 / 214** | **0** (documentation-only phase; no test added, modified, skipped, or weakened) |

Per file: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` 46 ·
`migration-snapshot` 39. Exit code **0**.

## 13. TypeScript / lint / db:check / build results

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | **0 errors** | **0** |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`src/app/actions/job-actions.ts:8` — unused `Job`, untouched file) | **0** |
| `npm run db:check` | `Everything's fine 🐶🔥` (schema ⟷ journal consistent) | **0** |
| `npm run migration:preflight` | read-only production preflight, no drift (§6) | **0** |
| `npx vitest run` | **214 passed / 214** (7 files) | **0** |
| `npm run build` | compile ✓, TypeScript ✓ (19.6 s), then **static prerender fails** | **1** |

**Build failure — inherited blocker, assigned to P0E-1:** `next build` prerenders
routes that read data through `src/app/layout.tsx` → `src/services/master-service.ts`
→ `src/lib/google-sheets/client.ts`, which throws
`Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi`
(routes affected include `/clients` and `/crew`). This is pre-existing (P0A onward),
unrelated to the Fresh Start decision, and **no fake credentials, mock fallback, or
suppression was added**. P0E-1 acceptance requires this build to pass **without**
Google credentials.

## 14. Production/source data safety proof

- **MySQL:** only `SELECT` / `information_schema` statements were executed
  (`assertReadOnlyQuery` blocks DDL/DML keywords before execution; the preflight
  refuses any database other than `database-airprod`). No DDL, DML, seed, migrate,
  truncate, drop, reset, or overwrite occurred. All 14 tables remain at **0 rows**;
  journal remains `0000`; `job_id` remains NOT NULL; idempotency columns remain
  absent (§6). `airprod_test` was **not** used as a production database, and the
  preflight guard rejects it outright.
- **Google Sheets:** **no access of any kind** — no read, no write, no format, no
  delete, and no credential was requested. The archived tooling was not executed
  against the real spreadsheet.
- **Repository:** only Markdown files were created/modified; `getRepositories()`,
  `src/repositories/**`, the Google client, all pages/layouts/Server Actions,
  `src/db/**`, every schema file, every migration file, `package.json`, and every
  test file are **unchanged**. Nothing was committed, pushed, or deployed; HEAD is
  still `7c4cc41` and the working tree still holds all P0A→P0D-2A changes.
- No Google Sheets data was deleted, and no migration tooling or document was deleted.

## 15. Outstanding blockers

1. **Build requires Google Sheets credentials** (`GOOGLE_SHEETS_ID`) — the P0E-1 exit criterion.
2. **Runtime still Google Sheets** — no page/action/service rewired yet.
3. **`0001` not applied** — hard precondition for canonical MySQL financial writes; needs a separate P0E-2 approval.
4. **Canonical MySQL layer unused by the app** — 19 legacy-contract methods remain blocked in the MySQL adapter; activation requires Contract v2 rewiring, not stubs.
5. **UI/feature gaps** — venue removal from the active UI, expense → cashflow, derived payment status, `crew_roles` selection.
6. **Authentication/authorization absent** (P1A/P1B) — canonical `admins`/`sessions` are read-only.
7. **Job-number generation absent** (P2A) — canonical `jobs.create` needs an explicit `jobNumber`.
8. **Database provider for Vercel undecided** — no managed MySQL/MariaDB in the available service catalog; provider + serverless connection strategy is an open owner decision (Vercel publishes an official connection-pooling guide; the current `mysql2` pool is per-instance with `connectionLimit: 10`).
9. **No production-readiness increase** from skipping P0D (see §16).
10. **Observation on the uncommitted delta:** `package.json` and `package-lock.json`
    carry an uncommitted **`dotenv`** dependency addition that predates this phase
    (the files were written before P0D-CLOSE documentation, and this phase made **no**
    edits to them). They are in sync (`npm install --package-lock-only --dry-run`
    reports "up to date"). Flagged so the owner can review it as part of the
    uncommitted P0A→P0D work; P0D-CLOSE neither added nor removed it.

## 16. Updated progress and production readiness

| Metric | Before P0D-CLOSE | After P0D-CLOSE |
| --- | --- | --- |
| Completed technical milestones | 5 / 18 (27.8 %) | **5 / 18 (27.8 %)** — unchanged |
| Skipped by owner decision | 0 | **1** (P0D) — not counted as completed |
| Remaining | 13 | **12** (P0E → P4B) |
| Adjusted active-roadmap completion | n/a | **5 / 17 = 29.4 %** (denominator 18 − 1 skipped; a re-based figure, not a gain) |
| Production readiness | 3 / 10 | **3 / 10 — unchanged** |
| Tests | 214 / 214 | 214 / 214 |
| Active runtime | Google Sheets | Google Sheets (unchanged) |

**Skipping the migration does not make the application production-ready:** it still
runs on Google Sheets, MySQL is still unactivated, the build still needs external
credentials, and authentication, job numbering, and the UI phases remain unbuilt.
`docs/PROJECT-PROGRESS.md` §1 and §6 record this, and §10 now makes updating the
tracker a mandatory scope item and acceptance criterion for every later phase.

## 17. Final verdict

### **PASS** — roadmap revision and Fresh Start transition planning complete

The owner decision (Fresh Start MySQL) is recorded as authoritative and applied to
the roadmap: **P0D is SKIPPED by owner decision**, **P0D-2B is cancelled**, the
historical results of P0D-1 (PASS WITH LIMITATIONS) and P0D-2A (BLOCKED ON SOURCE
ACCESS) are preserved untouched, and all migration work is **archived rather than
deleted**. The historical 18-milestone roadmap is retained for traceability with a
per-milestone classification, and the progress metrics are reported with explicit
denominators: **historical 5/18 (27.8 %)** and **adjusted active-roadmap 5/17
(29.4 %)**, with **production readiness unchanged at 3/10**.

The read-only audit produced the verified starting point (runtime still Google
Sheets; canonical MySQL complete but unused; 14 tables, all 0 rows; journal `0000`;
`0001` required for canonical financial writes; Vercel provider decision open) and a
concrete, approval-gated **P0E-1** plan.

Non-destructive checks: `tsc` 0 errors · `lint` 0 errors (1 pre-existing warning) ·
`db:check` clean · **214/214 tests** · `npm run build` **exit 1** (inherited Google
Sheets prerender dependency, explicitly assigned to P0E-1) · read-only preflight
exit 0 with no drift and no writes.

**Stopping here as instructed.** P0E-1 is NOT started; nothing was committed,
pushed, deployed, migrated in production, or activated. Awaiting explicit owner
approval for the next phase.
