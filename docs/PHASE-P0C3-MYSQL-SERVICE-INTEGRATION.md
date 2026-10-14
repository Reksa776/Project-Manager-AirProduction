# PHASE P0C-3 — MYSQL SERVICE INTEGRATION

Status: **PASS WITH LIMITATIONS**
Scope: P0C-3 only (canonical MySQL repository composition, canonical repository
factory, canonical service layer + compatibility boundary, connection injection,
end-to-end backend integration tests, report, progress tracker).
No P0D/P0E work. MySQL is **not** activated as the application runtime.

---

## 1. Baseline Repository State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` (unchanged, nothing committed) |
| Working tree | All uncommitted P0A/P0B/P0C-1/P0C-2 work preserved — nothing reset, stashed, cleaned, or reverted |
| Active repositories | `getRepositories()` still returns `googleRepositories` (`src/repositories/index.ts:16`) — **unchanged** |
| Production DB | `database-airprod` — **14 tables, untouched** (verified: `cashflows.job_id` still `NOT NULL`, no idempotency columns, no UNIQUE on `cashflows`) |
| Migration history | `drizzle/0000_magical_true_believers.sql` (committed, untouched) + `drizzle/0001_dizzy_sunspot.sql`. **No new migration in P0C-3.** |
| Test baseline | 98/98 passing (22 db-foundation + 22 mysql-repository + 31 domain-contract + 23 finance-service) |
| TypeScript / Lint baseline | 0 errors / 0 errors (1 pre-existing warning in `src/app/actions/job-actions.ts`) |
| Build baseline | Fails at static prerender on missing `GOOGLE_SHEETS_ID` (pre-existing Google Sheets dependency) |

Documents read before coding: `docs/FULL-PROJECT-AUDIT.md`,
`docs/PHASE-MYSQL-REDESIGN.md`, `docs/PHASE-P0A-MYSQL-RECOVERY.md`,
`docs/PHASE-P0B-MYSQL-REPOSITORY.md`, `docs/PHASE-P0C1-DOMAIN-RECONCILIATION.md`,
`docs/PHASE-P0C2-FINANCIAL-REPOSITORY.md`, plus the live sources of
`src/repositories/contract/types.ts`, `src/repositories/types.ts`,
`src/repositories/mysql/**`, `src/services/**`, `src/domain/**`, the DB schema and
both migrations. Previous verdicts were re-checked against their reports
(see §7 note on P0A).

---

## 2. Files Created / Modified

### Created (P0C-3)

**Canonical MySQL repositories**
- `src/repositories/mysql/canonical/mapping.ts` — row → canonical domain mappers (Contract v2)
- `src/repositories/mysql/canonical/masters.ts` — clients, vendors, crew roles, crew
- `src/repositories/mysql/canonical/jobs.ts` — jobs
- `src/repositories/mysql/canonical/deliveries.ts` — deliveries
- `src/repositories/mysql/canonical/admin-sessions.ts` — admins, sessions (read-only per contract)
- `src/repositories/mysql/canonical/factory.ts` — **canonical repository factory** + `CONTRACT_V2_METHODS`
- `src/repositories/mysql/canonical/index.ts` — barrel

**Canonical service layer (compatibility boundary)**
- `src/services/canonical/errors.ts` — `CanonicalServiceError`
- `src/services/canonical/masters.ts` — `createMasterService`
- `src/services/canonical/jobs.ts` — `createJobService` (+ composed job detail)
- `src/services/canonical/deliveries.ts` — `createDeliveryService`
- `src/services/canonical/admin-sessions.ts` — `createAdminSessionService`
- `src/services/canonical/index.ts` — `createCanonicalServices`, `createMySqlApplication`

**Tests / docs**
- `tests/mysql-service-integration.test.ts` — 31 integration tests
- `docs/PHASE-P0C3-MYSQL-SERVICE-INTEGRATION.md` — this report
- `docs/PROJECT-PROGRESS.md` — permanent progress tracker (created in this phase)

### Modified (P0C-3)

- `src/repositories/mysql/finance/cashflows.ts` — added `createCashflowRepository(resolveDb)`; internal queries take an injected `Database`; singleton `mysqlCashflows` kept (lazy `getDb()`, no connection at import)
- `src/repositories/mysql/finance/schedules.ts` — `createClientPaymentScheduleRepository` / `createVendorPaymentScheduleRepository`; singletons kept
- `src/repositories/mysql/finance/job-crew-assignments.ts` — `createJobCrewAssignmentRepository`; singleton kept
- `src/repositories/mysql/finance/index.ts` — factory re-exports + `createFinanceRepositories(resolveDb)` aggregate
- `src/services/finance-service.ts` — `createFinancialService(resolveDb)` factory; module singletons (`financialOperations`, `financeService`, named helpers) preserved with identical behaviour

### Explicitly NOT modified

`src/repositories/index.ts` (`getRepositories()`), `src/repositories/google/**`,
`src/repositories/mysql/index.ts` (legacy-contract MySQL adapter from P0B),
all pages/layouts/components/navigation, all Server Actions, `src/services/{job,dashboard,master}-service.ts`,
`src/db/schema/**`, `drizzle/**`, `package.json`, and the test files of previous
phases (`db-foundation`, `mysql-repository`, `domain-contract`, `finance-service`).

---

## 3. Contract v2 Implementation Matrix

Contract source of truth: `src/repositories/contract/types.ts` → `MySqlRepositories`.
Legend: **NEW** = implemented in P0C-3; **REUSE** = P0C-2 repository reused unchanged in semantics.

| Member | Contract interface | Methods | Impl | Status |
| --- | --- | --- | --- | --- |
| `jobs` | `CanonicalJobRepository` | getAll, getById, getByJobNumber, create, update, delete (6) | `canonical/jobs.ts` | **NEW** |
| `clients` | `WritableRepository<Client,…>` | getAll, getById, create, update, delete (5) | `canonical/masters.ts` | **NEW** |
| `vendors` | `WritableRepository<Vendor,…>` | 5 | `canonical/masters.ts` | **NEW** |
| `crew` | `WritableRepository<Crew,…>` | 5 | `canonical/masters.ts` | **NEW** |
| `crewRoles` | `WritableRepository<CrewRole,…>` | 5 | `canonical/masters.ts` | **NEW** |
| `deliveries` | `CanonicalDeliveryRepository` | getAll, getById, getByJobId, create, update, delete (6) | `canonical/deliveries.ts` | **NEW** |
| `jobCrewAssignments` | `CanonicalJobCrewAssignmentRepository` | 6 | `finance/job-crew-assignments.ts` | **REUSE** |
| `clientPaymentSchedules` | `CanonicalClientPaymentScheduleRepository` | 6 | `finance/schedules.ts` | **REUSE** |
| `vendorPaymentSchedules` | `CanonicalVendorPaymentScheduleRepository` | 6 | `finance/schedules.ts` | **REUSE** |
| `cashflows` | `CanonicalCashflowRepository` | getAll, getById, getByJobId, create (4) + `query`, `totals` (extension) | `finance/cashflows.ts` | **REUSE** |
| `admins` | `ReadRepository<Admin>` | getAll, getById (2) | `canonical/admin-sessions.ts` | **NEW** |
| `sessions` | `CanonicalSessionRepository` | getAll, getById, getByTokenHash (3) | `canonical/admin-sessions.ts` | **NEW** |

**Totals: 12/12 contract members implemented — 59/59 contract methods. 0 missing, 0 throwing placeholders.**
**Missing methods:** none — Contract v2 defines no method that is left unimplemented
or stubbed. **Semantic incompatibilities** are the legacy-only concerns in the next
table (venues, expenses, stored payment status, `Job.venueId`,
`JobCrew.role`/`actualPayment`/`paymentStatus`); they are resolved by contract
design, not by omission. The matrix is encoded in code as `CONTRACT_V2_METHODS`
(`canonical/factory.ts`) and asserted by the test suite.

### Legacy-only methods and semantic incompatibilities

The legacy contract (`src/repositories/types.ts` → `DataRepositories`, used by the
running Google Sheets app) is **not** part of Contract v2. Its methods are handled as follows:

| Legacy-only concern | Handling in Contract v2 |
| --- | --- |
| `venues.*` (5 methods) | Excluded by design; Venue removed. Historical names preserved via `Job.legacyVenueName`. |
| `expenses.*` (6 methods) | Excluded; replaced by `cashflows` (direction `EXPENSE`, job optional). |
| `clientPayments.create/update/delete`, `vendorPayments.create/update/delete` (6 methods) | Superseded by separated **schedules** (obligations) + **cashflows** (actual money), exposed through `FinancialOperations`. |
| `Job.venueId` (legacy field) | No column; canonical `Job` has no `venueId`. P0B legacy adapter rejects writes with `venueId` explicitly. |
| `JobCrew.role` / `actualPayment` / `paymentStatus` | `role` → `job_crews.crew_role_id` override; `actualPayment` → `agreedAmount` (obligation, not cash); `paymentStatus` is **derived**, never stored. |

The P0B MySQL adapter for the legacy contract (`src/repositories/mysql/index.ts`,
17 blocked methods) is intentionally **left untouched** — it serves the legacy
contract only and is not part of Contract v2.

### Methods that depend on future business features (documented, not faked)

- Automatic job-number generation (`JOB-YYYY-NNNNNN`) → **P2A**. Canonical
  `jobs.create` accepts `jobNumber` verbatim (historical values preserved).
- Authentication/authorization, password verification, session creation/expiry enforcement → **P1A/P1B**.
  Hence `admins`/`sessions` are read-only in Contract v2.
- Legacy→MySQL historical data migration (venue archive, `CREW`/`VENDOR` expense rule, crew-role list) → **P0D**.

---

## 4. Canonical Repository Factory

`src/repositories/mysql/canonical/factory.ts`

```ts
export function createCanonicalMySqlRepositories(
  options: CanonicalMySqlFactoryOptions = {},
): CanonicalMySqlRepositories
```

- Returns the **complete** `MySqlRepositories` aggregate (12 members), typed by the
  contract — the compiler enforces completeness, no `any`/unsafe casts.
- **Connection injection:** `options.database?: () => Database` is a *resolver*
  invoked per operation. Default is `getDb`, which is only *referenced* at module
  import and *called* on first use → **no connection is opened during module
  import** and no connection string is embedded in the module.
- **No fallback:** the factory never imports or calls `getRepositories()` /
  `googleRepositories` (asserted by a structural test).
- **No placeholders:** every method performs a real query; the only guarantee
  needed is that the aggregate is built by explicit invocation (tests / isolated
  integration code). There is deliberately **no module-level singleton** for the
  canonical repositories.
- Financial members are built by `createFinanceRepositories(resolveDb)`, so the
  *same* injected connection is used by every repository (cashflows, schedules,
  crew assignments) and by the financial service transactions
  (`createMySqlApplication`).

`src/services/canonical/index.ts` provides the full backend bootstrap:

```ts
export function createMySqlApplication(
  options?: CanonicalMySqlFactoryOptions,
): { repositories, financial, services }
```

It resolves one connection resolver, builds the repository aggregate, the
financial service, and the canonical services over the same connection.

---

## 5. Service Integration Architecture

```
Legacy runtime (UNCHANGED, Google Sheets)
  app pages / Server Actions
        │
        ▼
  src/services/{job,dashboard,master}-service.ts  ──►  getRepositories() ──► googleRepositories
        (legacy contract `DataRepositories`, `src/lib/types.ts`)              (read/write Sheets)

Canonical layer (P0C-3, NOT wired to the app)
  src/services/canonical/**            ← compatibility boundary
        │  depends ONLY on Contract v2 (`MySqlRepositories`) + `FinancialOperations`
        ▼
  createMySqlApplication()  ──►  createCanonicalMySqlRepositories()  ──►  MySQL (Drizzle/mysql2)
                                + createFinancialService(resolveDb)
```

**Compatibility boundary.** The canonical service layer (`src/services/canonical/**`)
imports only `src/repositories/contract`, `src/domain/**`, and the canonical
repository/service modules. It never imports the legacy contract
(`@/repositories/types`), the legacy domain (`@/lib/types`), the Google repository,
or `getRepositories()`. This is enforced by a structural test that scans every
canonical source file (§8, test 14). Services are constructed with explicit
dependency injection (`createCanonicalServices({ repositories, financial })`), so
they can be tested against any connection without touching application code.

**What the canonical services add on top of the repositories**
- `master`: sorted listing + `listCrewDirectory()` composing `crew` with `crewRoles`
  (resolved role objects, no duplicated role strings).
- `jobs`: `getJobDetail(jobId)` composes the job with its counterparty, client/vendor
  schedules, crew assignments, deliveries, and cashflows in one call — the
  obligation/cash separation is preserved (no derived field is persisted).
- `deliveries`, `adminSessions`: thin, contract-faithful wrappers (persistence only).
- `financial`: the concrete P0C-2 financial service (not a copy). No financial logic
  is re-implemented in the canonical layer; the service is passed through.

**Field/reference validation boundary.** For the canonical MySQL layer, field
validation, enum checks, XOR rules, and reference existence checks live in the
repository implementation (one source of truth, enforced before the DB constraint
as a last line of defence). The service layer adds composition errors
(`CanonicalServiceError`). The legacy service layer keeps its own validation and is
untouched.

**Deferred dependencies (require UI work or a business decision — not integrated)**
- Legacy services/pages/actions still consume the legacy contract; migrating them is
  P0E/P2 work, not P0C-3.
- Venue UI and the expense screens have no canonical equivalent by design; they must
  be redesigned/retired (P2D/P3A) before activation.
- `Job.legacyVenueName` backfill needs the historical venue archive (P0D).
- Crew `isActive` de-activation policy (soft-disable vs delete) is not enforced as a
  business rule — deletion is RESTRICT-protected by the DB only.

---

## 6. Financial Integrity Preservation

No financial guarantee from P0C-2 was weakened; the only change is connection
injection (identical behaviour, verified by the untouched 23 finance tests).

| Guarantee | Status |
| --- | --- |
| Decimal-string money (`Amount`) | Preserved. Canonical `Crew.defaultPayment`, schedules, `agreedAmount`, cashflows all round-trip as strings. |
| BigInt minor-unit arithmetic | Preserved (`src/domain/money.ts`); no new float arithmetic anywhere. |
| Money never converted back to JS `number` in the canonical path | Preserved. The `number` mapping exists only in the **legacy** P0B adapter (`src/repositories/mysql/mapping.ts`), which is not part of Contract v2. |
| Atomic financial writes (one cashflow insert per payment, rollback on failure) | Preserved (`createFinancialService`, Drizzle transaction). |
| Database-backed idempotency | Preserved: `cashflows.idempotency_key` UNIQUE + SHA-256 payload fingerprint. Re-verified through the canonical bootstrap (replay → same row; same key + different payload → `RepositoryConflictError`). |
| Derived payment status (never stored) | Preserved (`derivePaymentStatus`/`deriveSettlement`). `paid_date` is only a convenience snapshot. |
| Obligations vs actual cash separated | Preserved: schedules / `agreed_amount` are obligations; only `cashflows` moves money. Creating a schedule creates 0 cashflow rows (asserted). |
| Overpayment detectable | Preserved (`overpaid`, `overpaidAmount`). |
| Optional Job for operational expenses | Preserved (`cashflows.job_id` nullable); asserted through the canonical service. |
| Existing financial service not bypassed | The canonical layer receives the P0C-2 `FinancialService` instance; nothing calls the financial repositories directly to move money. |

---

## 7. Migration Compatibility

- **No new migration.** `drizzle/meta/_journal.json` still lists exactly
  `0000_magical_true_believers` and `0001_dizzy_sunspot`; no additional SQL file
  exists; `npm run db:check` → `Everything's fine 🐶🔥`.
- **Both migrations applied to the isolated test DB** by `tests/setup.ts`
  (create `airprod_test` → drop all tables → `drizzle/` migrations), and every
  integration test runs against the post-`0001` schema (nullable `cashflows.job_id`,
  `idempotency_key` UNIQUE + fingerprint). No schema defect was found that would
  require a further migration, so none was created.
- **`database-airprod` untouched** (verified after this phase; see §10).
- Previous verdicts re-checked against their reports: P0B, P0C-1, P0C-2 are
  `PASS WITH LIMITATIONS` as recorded. **Note:** `docs/PHASE-P0A-MYSQL-RECOVERY.md`
  records P0A as **PASS WITH LIMITATIONS** (build/prerender limitation), whereas the
  P0C-3 brief's baseline table lists P0A as `PASS`. This report follows the actual
  report (P0A = PASS WITH LIMITATIONS) and flags the discrepancy rather than
  restating an unverified verdict. P0A still counts as a completed milestone.

---

## 8. Integration Test Coverage

`tests/mysql-service-integration.test.ts` — 31 tests, all against `airprod_test`
only. The canonical factory is invoked explicitly; the app provider is never used.

| # | Required flow | Test |
| --- | --- | --- |
| — | Contract v2 matrix + factory completeness (all 12 members, every method a function) | “membangun SELURUH anggota Contract v2…” |
| — | No throwing placeholders (all repositories read) | “tidak ada placeholder yang melempar…” |
| — | Connection injection: no resolver call at construction, called on use | “koneksi disuntikkan…” |
| 1 | Create & read Client (with `companyName`/`clientType`) | flow master data |
| 2 | Create & read Vendor | flow master data |
| 3 | Create & read Crew Role | flow master data |
| 4 | Create Crew with an existing role (+ unknown role rejected, blank name rejected) | flow master data |
| 5 | Create & read Job (+ `legacyVenueName`, `getByJobNumber`, vendor-only job) | flow job |
| 6 | Create Job-Crew Assignment (obligation; creates no cash) | flow assignment/delivery/jadwal |
| 7 | Create Delivery + read per job | flow assignment/delivery/jadwal |
| 8 | Create client & vendor payment schedules (obligations, 0 cashflows) | flow assignment/delivery/jadwal |
| 9 | Record financial transactions through the approved service (client partial→full, crew, general expense without job, idempotent replay, conflict) | flow finansial |
| 10 | Read financial totals & derived status (`totals`, `getJobFinancialSummary`, `deriveClientPaymentStatus`, `deriveCrewSettlement`, history) | flow finansial |
| 11 | Admin/Session persistence without login (read persisted rows via canonical repos) | admin & session persistence |
| 12 | Relational integrity: job→client RESTRICT delete blocked; FK `RESTRICT` verified | integritas relasi |
| 13 | Invalid references fail explicitly (unknown `crewRoleId` → `RepositoryNotFoundError`; unknown job for delivery; FK errors for assignment/schedule) | integritas relasi |
| 14 | No Google Sheets / legacy dependency needed (structural import scan + suite runs without Google credentials) | batas kompatibilitas |

Additional coverage: XOR violation rejected; job update/delete; client delete when
unreferenced; composed `getJobDetail` (counterparty + obligations + cash).

Test isolation: `tests/setup.ts` guards `DATABASE_URL` → `database-airprod`, then
creates/resets/migrates **`airprod_test`** only. No production data is used as a fixture.

---

## 9. Test Results Before / After

Command: `npx vitest run` (serial, isolated `airprod_test`).

| Test file | Before | After |
| --- | --- | --- |
| `tests/db-foundation.test.ts` | 22 | 22 |
| `tests/mysql-repository.test.ts` | 22 | 22 |
| `tests/domain-contract.test.ts` | 31 | 31 |
| `tests/finance-service.test.ts` | 23 | 23 |
| `tests/mysql-service-integration.test.ts` | — | **31 (new)** |
| **Total** | **98 passed** | **129 passed (5 files)** |

Finance idempotency tests from P0C-2 remain passing unchanged (replay, conflicting
payload, and 6-way concurrent duplicates → exactly one cashflow row), and the
canonical bootstrap re-asserts replay/conflict through the injected connection.

No regression, no skipped test, no weakened assertion.

---

## 10. TypeScript / Lint / Build Results

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | **0 errors** | 0 |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`Job` unused import in `src/app/actions/job-actions.ts`, untouched) | 0 |
| `npm run db:check` | `Everything's fine 🐶🔥` | 0 |
| `npx vitest run` | **129 passed / 129** | 0 |
| `npm run build` | Compile ✓ (`Compiled successfully in 3.4s`), TypeScript ✓ (`Finished TypeScript in 20.3s`), then **fails at static prerender** | 1 |

Build failure (pre-existing, reported separately): prerendering `/dashboard` throws
`Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi` from
`src/lib/google-sheets/client.ts` → `src/repositories/google/index.ts` →
`src/services/master-service.ts` → `src/app/layout.tsx`. No credentials were
invented and no fake/mock fallback was introduced. This is the active Google Sheets
runtime still being wired to the app (unchanged by P0C-3) — and it independently
confirms that the application has **not** switched to MySQL.

---

## 11. Production Data Safety

Verified after this phase with read-only queries against `information_schema`:

- `database-airprod` still has **14 tables**
  (`admins, cashflows, clients, client_payments, crew, crew_roles, deliveries, jobs,
  job_crews, job_sequences, sessions, vendors, vendor_payments, __drizzle_migrations`).
- `cashflows.job_id` is still `IS_NULLABLE = NO`.
- `idempotency_key` / `idempotency_fingerprint` are **absent** and `cashflows` has
  **no UNIQUE constraint** — i.e. migration `0001` has **not** been applied to
  production.
- No production row was written, updated, or deleted: every test in this phase runs
  against the isolated `airprod_test` database (guarded by `tests/setup.ts`).
- `getRepositories()` still returns `googleRepositories`, so the live application
  continues to read/write Google Sheets.

---

## 12. Known Limitations

1. **Build cannot exit 0** without real Google Sheets credentials (or dynamic data
   pages). Inherited external blocker; compile and TypeScript stages pass.
2. **MySQL is not activated.** `getRepositories()` still returns
   `googleRepositories`; no page, Server Action, or legacy service was rewired. The
   canonical layer is only reachable from tests/isolated code (P0E work).
3. **`admins`/`sessions` are read-only** by contract; authentication, session
   creation/expiry and authorization are P1A/P1B. The integration test demonstrates
   persistence reads without implementing login.
4. **The legacy-contract MySQL adapter (`src/repositories/mysql/index.ts`) still
   contains 17 blocked methods** (venues 5, expenses 6, payment writes 6). They serve
   the *legacy* contract only; Contract v2 has no placeholders. Left untouched to
   preserve P0B behaviour.
5. **Legacy service layer unchanged** (`job-service`, `dashboard-service`,
   `master-service`) — canonical and legacy coexist. Canonical UI/action migration is
   deferred.
6. **Job number generator not implemented** (P2A): the canonical repo requires an
   explicit `jobNumber`.
7. **No workflow rules** for delivery/crew-role lifecycle (status transitions and
   role de-activation are explicit caller decisions; `crew_roles` deletion is only
   DB-RESTRICT-protected).
8. **Historical migration prerequisites remain** (see §13) — required before any data
   migration, but they do not block P0C-3.

---

## 13. P0D Prerequisites

1. **Historical venue archive** parsed and mapped to `Job.legacyVenueName`
   (otherwise jobs whose `venueId` has no known name stay `RECONCILIATION_REQUIRED`).
2. **`CREW`/`VENDOR` legacy expense rule** decided (avoid double-counting against
   `job_crews`/`vendor_payments` when converting sheet expenses to cashflows).
3. **Final crew-role list** agreed before crew/assignment rows can be mapped (no
   implicit role creation).
4. **Stored legacy payment statuses** reconciled against derivable status
   (`reconcileStoredPaymentStatus`) — mismatch ⇒ explicit reconciliation, not silent.
5. **Migration `0001` rollout window** for `database-airprod` (nullable `job_id` +
   idempotency columns) — still NOT applied to production.
6. **Idempotency key strategy for migrated rows** — whether historical cashflows are
   imported with `source='MIGRATION'` and synthetic keys, so re-runs stay idempotent.
7. Decision on how much of the legacy MySQL adapter (`src/repositories/mysql/index.ts`)
   is retired once Contract v2 becomes the runtime.

---

## 14. Final Verdict

### Acceptance criteria check

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Every required Contract v2 repository implemented | ✅ 12/12 members, 59/59 methods |
| 2 | Canonical repository factory complete | ✅ `createCanonicalMySqlRepositories` (type-checked against `MySqlRepositories`) |
| 3 | No throwing placeholders in the canonical factory | ✅ asserted by test (all members read successfully) |
| 4 | Canonical service integration is testable | ✅ DI + 31 integration tests |
| 5 | Financial invariants remain intact | ✅ 23 P0C-2 tests pass unchanged + re-verified via bootstrap |
| 6 | Integration tests pass | ✅ 31/31 |
| 7 | All previous 98 tests remain passing | ✅ 129/129 total |
| 8 | TypeScript zero errors | ✅ |
| 9 | Lint zero errors | ✅ (1 pre-existing warning, untouched file) |
| 10 | No active application runtime switch | ✅ `getRepositories()` unchanged; build still prerenders through Google Sheets |
| 11 | No production data modified | ✅ verified (14 tables, `job_id NOT NULL`, no idempotency columns) |
| 12 | Remaining migration prerequisites documented | ✅ §13 |

### Verdict

**PASS WITH LIMITATIONS.**

All 12 acceptance criteria are met: the complete Contract v2 aggregate is
implemented and constructed by an explicit, connection-injectable factory; no
placeholder implementations remain; the canonical service layer operates only
against Contract v2 behind a tested compatibility boundary; every financial
guarantee from P0C-2 is preserved and re-verified; both migrations work against the
isolated test database with no new migration required; 31 new integration tests pass
alongside the 98 pre-existing tests (129 total); TypeScript and lint are clean; the
active Google Sheets runtime and the production database are untouched.

**Limitations (inherited / by design, none of them a P0C-3 defect):** `npm run build`
still fails only at static prerender because `GOOGLE_SHEETS_ID` is not configured
(pre-existing); MySQL remains inactive by instruction; admin/session writes belong to
P1A; and the P0D historical-migration prerequisites in §13 must be resolved before
any data migration. This limitation set is the same class recorded by P0A–P0C-2.
