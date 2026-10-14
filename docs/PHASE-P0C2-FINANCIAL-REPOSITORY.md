# PHASE P0C-2 — FINANCIAL REPOSITORY & SERVICES

Status: **PASS WITH LIMITATIONS**
Scope: P0C-2 only (finance schema prerequisites, cashflow/schedule/crew
repositories, financial services, transactions & idempotency, tests, report).
No P0C-3 work.

---

## 1. Baseline State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` |
| Prior phases | P0A (MySQL recovery), P0B (MySQL repository), P0C-1 (domain & contract) |
| Working tree | All existing uncommitted work preserved — nothing reset/stashed/cleaned |
| Active repositories | `getRepositories()` still returns `googleRepositories` (`src/repositories/index.ts:16`) — unchanged |
| Production DB | `database-airprod` — **14 tables, untouched**; `cashflows.job_id` still `NOT NULL`, idempotency columns absent |
| Migration history | `drizzle/0000_magical_true_believers.sql` (committed baseline, untouched) + new `drizzle/0001_dizzy_sunspot.sql` |

---

## 2. Root Problems Addressed

1. **`cashflows.job_id NOT NULL`** blocked general operational expenses without a Job. Fixed by making the column nullable while keeping the FK (`RESTRICT`) for job-related transactions.
2. **No database-backed idempotency**, so repeated/concurrent financial writes could double-count. Fixed with a `UNIQUE` `idempotency_key` + payload fingerprint column.
3. **No canonical financial API** existed (P0B only ran the legacy Google contract). Added Cashflow/Schedule/Crew repositories + a financial service.
4. **Decimal precision** was at risk because money columns were mapped to JS `number`. Money columns now round-trip as decimal **strings**.

---

## 3. Files Created / Modified

**Created**
- `src/repositories/mysql/finance/executor.ts` — shared query executor type
- `src/repositories/mysql/finance/idempotency.ts` — fingerprint + duplicate detection
- `src/repositories/mysql/finance/values.ts` — decimal-safe amount normalization
- `src/repositories/mysql/finance/mapping.ts` — canonical row → domain mapping
- `src/repositories/mysql/finance/cashflows.ts` — canonical Cashflow repository
- `src/repositories/mysql/finance/schedules.ts` — client & vendor payment schedules
- `src/repositories/mysql/finance/job-crew-assignments.ts` — crew obligations
- `src/repositories/mysql/finance/index.ts` — barrel + aggregate
- `src/services/finance-service.ts` — financial services + `FinancialOperations`
- `tests/finance-service.test.ts` — 23 integration tests
- `docs/PHASE-P0C2-FINANCIAL-REPOSITORY.md` — this report

**Modified**
- `src/db/schema/{cashflows,crew,job-crews,client-payments,vendor-payments}.ts` — money columns `mode: "string"`; `cashflows.job_id` nullable; idempotency columns + unique index
- `src/repositories/mysql/{mapping,index}.ts` — convert decimal strings ⇄ legacy `number` (legacy contract stays numeric)
- `src/repositories/mysql/errors.ts` — `RepositoryConflictError`, `RepositoryInUseError`
- `src/domain/{types,inputs}.ts`, `src/repositories/contract/types.ts` — `Cashflow.jobId` now optional
- `tests/db-foundation.test.ts`, `tests/mysql-repository.test.ts` — decimal literals as strings
- `drizzle/0001_dizzy_sunspot.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0001_snapshot.json` — new migration

**Not modified:** Google repository, app pages/UI, existing Server Actions, `getRepositories()`.

---

## 4. Schema Changes

- `cashflows.job_id` → **NULLABLE** (FK to `jobs.id` retained, `ON DELETE RESTRICT`).
- `cashflows.idempotency_key varchar(190)` NULL + `UNIQUE (idempotency_key)`
  (MySQL allows many NULLs, so key-less manual rows still work).
- `cashflows.idempotency_fingerprint char(64)` NULL — SHA-256 payload digest.
- Money columns (`cashflows.amount`, `client_payments.amount`,
  `vendor_payments.amount`, `job_crews.agreed_amount`, `crew.default_payment`)
  mapped as decimal **strings** (client-side only; column type unchanged); two
  `DEFAULT '0.00'` normalizations (semantically identical to `DEFAULT 0`).

No CHECK constraints were removed; all invariants (direction/category/reference/source, amount > 0, XOR job) remain.

---

## 5. Migration Safety

- New additive migration only: `drizzle/0001_dizzy_sunspot.sql`. The committed `0000` baseline is untouched; no historical migration file was edited.
- `npx drizzle-kit generate` after all schema edits reports **"No schema changes"** (snapshot consistent).
- **Upgrade test on a throwaway DB** `airprod_migration_check`: applied `0000`, seeded a client/job/cashflow, applied `0001`, then verified — baseline row preserved (`amount="100.00"`, `job_id="j1"`), `job_id`/idempotency columns now nullable, `uq_cashflows_idempotency_key` present, `cashflows` FK count = 1. DB dropped afterward.
- Applied to the **isolated `airprod_test` only** (via `tests/setup.ts`). **Never applied to `database-airprod`** (verified: prod still 14 tables, `job_id NOT NULL`, no idempotency columns).

---

## 6. Cashflow Repository Implementation

`src/repositories/mysql/finance/cashflows.ts` (`mysqlCashflows`):

- `getAll`, `getById`, `getByJobId` (Contract v2) + `query(filter)` (job/reference/direction/category/date range) + `totals(filter)`.
- Amounts read/written as canonical `Amount` strings (`parseAmount`), no floating point.
- `insertCashflow(executor, data)` — validates the cashflow invariant, computes the fingerprint, inserts; on duplicate-entry it re-reads and resolves replay vs conflict. No pre-`SELECT` (avoids freezing a REPEATABLE-READ snapshot and thus losing the race winner).
- `sumPaidForReference(executor, type, id)` — exact `SUM` cast to char.

---

## 7. Payment Schedule Implementation

`src/repositories/mysql/finance/schedules.ts`:

- `mysqlClientPaymentSchedules`, `mysqlVendorPaymentSchedules` — `getAll`, `getById`, `getByJobId`, `create`, `update`, `delete`.
- **Creating a schedule never creates cash** — verified (0 cashflows after schedule creation).
- `delete` is rejected (`RepositoryInUseError`) when cashflows reference the schedule.
- `update` rejects moving a schedule with recorded payments to another Job.
- Status is never stored — always derived (see §9).

---

## 8. Crew Payment Implementation

`src/repositories/mysql/finance/job-crew-assignments.ts` (`mysqlJobCrewAssignments`):

- `job_crews` = obligation (`agreed_amount`); deferred cash via `cashflows`
  (`EXPENSE` / `CREW_PAYMENT`, reference `job_crew`).
- `delete` rejected when crew cash references the assignment.
- Service `deriveCrewSettlement` keeps **agreedAmount / paidAmount /
  remainingAmount / status** separate and reports overpayment.

---

## 9. Financial Services

`src/services/finance-service.ts`, implementing `FinancialOperations`:

- `recordClientPayment`, `recordVendorPayment`, `recordCrewPayment` — atomic
  Drizzle transactions: insert cashflow (+ set `paid_date` when settled).
- `recordGeneralExpense` — `EXPENSE` with category `TRANSPORT|EQUIPMENT|OTHER`,
  **Job optional** (NULL `job_id`).
- `readFinancialHistory` (delegates to `readCashflows`), `deriveClientPaymentStatus`,
  `deriveCrewSettlement`, `getJobFinancialSummary`.
- Status rules (from `deriveSettlement`): `paid<=0 → UNPAID`; `0<paid<obligation →
  PARTIAL`; `paid>=obligation → PAID`; overpay detectable.
- All inputs validated at the boundary: amount > 0, `occurredOn` `YYYY-MM-DD`,
  non-empty `idempotencyKey`, category allow-list, reference existence.

---

## 10. Transaction & Idempotency Design

- **Atomicity:** each payment/expense is one `db.transaction`; a failure rolls
  back the whole operation (proved by the rollback test).
- **Idempotency:** `idempotency_key` UNIQUE enforces uniqueness at the database
  level (not in-memory). Identical key + payload → returns the existing row
  (no new transaction). Same key + different payload → `RepositoryConflictError`.
- **Concurrency:** losers of a race receive `ER_DUP_ENTRY`, re-read the winner
  (after its commit) and return/reject deterministically. Test: 6 concurrent
  identical requests → **exactly one** cashflow row; all callers get the same id.
- Existing `cashflows` uniqueness (PK) and reference/CHECK rules remain intact.

---

## 11. Test Results

`npx vitest run` (isolated `airprod_test`):

| File | Tests |
| --- | --- |
| `tests/db-foundation.test.ts` | 22 (retained) |
| `tests/mysql-repository.test.ts` | 22 (retained) |
| `tests/domain-contract.test.ts` | 31 (retained) |
| `tests/finance-service.test.ts` | **23 (new)** |
| **Total** | **98 passed / 98** |

Before: 75 passing. After: 98 passing (no regression). New coverage: cashflow
create/read/totals, decimal precision (large values), schedule create (no cash),
client partial→PAID + `paid_date`, vendor payment, crew partial→PAID + agreed/paid
split, overpayment detection, expense without Job, invalid monetary values,
schedule delete block, missing references, idempotent replay, conflicting payload,
concurrent duplicates, transaction rollback, job summary, reconciliation boundaries.

---

## 12. Financial Integrity Verification

- Decimal strings round-trip exactly (`9999999999999.99` preserved).
- Creating a schedule creates **0** cashflows.
- `JobCrew.agreedAmount` never treated as paid; paid derived from cash only.
- Overpayment remains detectable (`overpaid`, `overpaidAmount`).
- Duplicate/concurrent writes cannot double-count (unique index + fingerprint).
- Rollback leaves no orphan cash.
- Historical ambiguities (`CREW`/`VENDOR` expense categories; mismatched stored
  status) stay `RECONCILIATION_REQUIRED` — no synthetic cash is created, no dates invented, no historical migration performed.

---

## 13. TypeScript / Lint / Build Results

- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **0 errors** (1 pre-existing warning in `src/app/actions/job-actions.ts`, out of scope).
- `npm run db:check` → `Everything's fine 🐶🔥`.
- `npm run build` → **fails at static prerender** on
  `Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi`.
  Compilation ✓ and TypeScript ✓ both pass. This is the **pre-existing Google
  Sheets limitation**, reported separately; no fake credentials/mocks added.

---

## 14. Production Data Safety

- New migration applied **only** to `airprod_test`.
- `database-airprod` verified unchanged: 14 tables; `cashflows.job_id` `NOT NULL`;
  no idempotency columns.
- Tests use no production records; `tests/setup.ts` guard aborts unless
  `DATABASE_URL` points at `database-airprod`, then switches to `airprod_test`.
- `getRepositories()` unchanged; active Google application untouched.

---

## 15. Remaining Risks

1. **Build** needs real Google credentials (or dynamic data pages) — inherited.
2. The new canonical finance layer is **not wired into the app**; MySQL remains inactive by design.
3. Idempotency keys are supplied by the caller; a caller that omits/derives keys poorly can still create distinct rows. The service requires a non-empty key for every financial write.
4. `update` of a schedule permits `amount < paid` (overpayment) by design — detectable, not blocked.
5. Money columns are still `decimal(15,2)`; values beyond that range are rejected by the DB.
6. Concurrent identical writes serialize on the unique index (correct but a throughput consideration under heavy load).

---

## 16. P0C-3 Prerequisites

- Wire the cashflow/schedule/crew repositories into an activatable `MySqlRepositories` (jobs/clients/vendors/crew/crewRoles/deliveries/admins/sessions still legacy-contract only).
- Decide the eventual `getRepositories()` switch and the Google→MySQL cutover plan.
- Provide the historical venue archive and the `CREW`/`VENDOR` expense reconciliation rule before any data migration.
- Decide UI/server-action integration for the finance service (out of P0C-2 scope).

---

## 17. Final Verdict

**PASS WITH LIMITATIONS.**

Acceptance criteria met: cashflow repository implemented; client/vendor schedule
repositories implemented; crew payment backend implemented; financial services
implemented; status derived from actual cashflow; general operational expenses
without Job supported; idempotency database-enforced (concurrent duplicates
produce exactly one row); transaction rollback works; decimal precision preserved;
historical ambiguities are not silently converted into transactions; all 75
existing tests remain green (98 total); new financial tests pass; TypeScript and
lint have zero errors; the active Google application is unchanged; production
database and records are untouched.

**Limitations:** build fails only on the pre-existing `GOOGLE_SHEETS_ID` prerender
dependency; the new finance layer is intentionally not yet activated for the
application (P0C-3).
